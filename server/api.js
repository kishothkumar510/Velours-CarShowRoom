const express = require('express');
const { randomBytes, randomUUID, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const cars = require('../data/cars.json');

const scryptAsync = promisify(scrypt);
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const carsById = new Map(cars.map(car => [car.id, car]));
const sessionCookie = 'velours-session';
const sessionLifetimeSeconds = 7 * 24 * 60 * 60;

function getSessionToken(request) {
  const cookies = (request.headers.cookie || '').split(';');
  const cookie = cookies.find(value => value.trim().startsWith(`${sessionCookie}=`));
  return cookie ? cookie.trim().slice(sessionCookie.length + 1) : '';
}

function createApiRouter() {
  const router = express.Router();
  const users = new Map();
  const sessions = new Map();
  const orders = new Map();

  function publicUser(user) {
    return { name: user.name, email: user.email };
  }

  function publicOrder(order) {
    const { ownerEmail, address, ...data } = order;
    return data;
  }

  function setSessionCookie(response, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader(
      'Set-Cookie',
      `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`
    );
  }

  function startSession(response, user) {
    const token = randomBytes(32).toString('hex');
    sessions.set(token, {
      email: user.email,
      expiresAt: Date.now() + sessionLifetimeSeconds * 1000
    });
    setSessionCookie(response, token);
  }

  function requireUser(request, response, next) {
    const token = getSessionToken(request);
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) sessions.delete(token);
      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    const user = users.get(session.email);
    if (!user) {
      sessions.delete(token);
      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    request.user = user;
    return next();
  }

  function validateEmail(email) {
    return typeof email === 'string' && email.length <= 254 && validEmail.test(email.trim());
  }

  router.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  router.get('/cars', (request, response) => {
    response.json(cars);
  });

  router.get('/session', (request, response) => {
    const token = getSessionToken(request);
    const session = sessions.get(token);
    const user = session && session.expiresAt > Date.now() ? users.get(session.email) : null;
    if (session && (!user || session.expiresAt <= Date.now())) sessions.delete(token);
    response.json({ user: user ? publicUser(user) : null });
  });

  router.post('/signup', async (request, response) => {
    const { name, email, password } = request.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (
      typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100 ||
      !validateEmail(normalizedEmail) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128
    ) {
      return response.status(400).json({
        error: 'Enter a name, a valid email address, and a password between 8 and 128 characters.'
      });
    }
    if (users.has(normalizedEmail)) {
      return response.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = randomBytes(16);
    const passwordHash = await scryptAsync(password, salt, 64);
    if (users.has(normalizedEmail)) {
      return response.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = {
      name: name.trim(),
      email: normalizedEmail,
      salt,
      passwordHash
    };
    users.set(normalizedEmail, user);
    startSession(response, user);
    return response.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', async (request, response) => {
    const { email, password } = request.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validateEmail(normalizedEmail) || typeof password !== 'string' || password.length > 128) {
      return response.status(400).json({ error: 'Enter a valid email address and password.' });
    }

    const user = users.get(normalizedEmail);
    if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' });

    const attemptedHash = await scryptAsync(password, user.salt, 64);
    if (!timingSafeEqual(user.passwordHash, attemptedHash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }

    startSession(response, user);
    return response.json({ user: publicUser(user) });
  });

  router.post('/logout', (request, response) => {
    const token = getSessionToken(request);
    if (token) sessions.delete(token);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader(
      'Set-Cookie',
      `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
    );
    return response.json({ message: 'You have been logged out.' });
  });

  router.post('/service-requests', (request, response) => {
    const { name, email, message } = request.body || {};
    if (
      typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100 ||
      !validateEmail(email) ||
      typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 2000
    ) {
      return response.status(400).json({ error: 'Enter a valid name, email address, and message.' });
    }

    return response.status(201).json({
      message: 'Your query has been submitted successfully. Our concierge will be in touch.'
    });
  });

  router.get('/delivery-requests', requireUser, (request, response) => {
    const userOrders = [...orders.values()]
      .filter(order => order.ownerEmail === request.user.email)
      .map(publicOrder)
      .reverse();
    response.json({ orders: userOrders });
  });

  router.post('/delivery-requests', requireUser, (request, response) => {
    const { address, carIds } = request.body || {};
    if (
      typeof address !== 'string' || address.trim().length < 1 || address.trim().length > 500 ||
      !Array.isArray(carIds) || carIds.length < 1 || carIds.length > cars.length ||
      carIds.some(id => typeof id !== 'string' || !carsById.has(id)) ||
      new Set(carIds).size !== carIds.length
    ) {
      return response.status(400).json({
        error: 'Enter a valid delivery address and select at least one available vehicle.'
      });
    }

    const selectedCars = carIds.map(id => carsById.get(id));
    const order = {
      id: `V-${randomUUID()}`,
      ownerEmail: request.user.email,
      cars: selectedCars.map(car => car.name),
      total: selectedCars.reduce((sum, car) => sum + car.price, 0),
      address: address.trim(),
      status: 'requested',
      createdAt: new Date().toISOString()
    };
    orders.set(order.id, order);
    return response.status(201).json(publicOrder(order));
  });

  router.patch('/delivery-requests/:id/cancel', requireUser, (request, response) => {
    const order = orders.get(request.params.id);
    if (!order || order.ownerEmail !== request.user.email) {
      return response.status(404).json({ error: 'Delivery request not found.' });
    }
    if (order.status !== 'requested') {
      return response.status(409).json({ error: 'This delivery request has already been cancelled.' });
    }

    order.status = 'cancelled';
    return response.json(publicOrder(order));
  });

  return router;
}

module.exports = { createApiRouter };
