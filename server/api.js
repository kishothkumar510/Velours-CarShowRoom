const express = require('express');
const {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual
} = require('node:crypto');
const { promisify } = require('node:util');
const cars = require('../data/cars.json');
const { createPostgresStore } = require('./store');

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

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createApiRouter({ store = createPostgresStore() } = {}) {
  const router = express.Router();

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

  async function startSession(response, user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);
    await store.createSession(hashSessionToken(token), user.email, expiresAt);
    setSessionCookie(response, token);
  }

  function route(handler) {
    return (request, response, next) => {
      Promise.resolve(handler(request, response, next)).catch(next);
    };
  }

  const requireDatabase = route(async (request, response, next) => {
    await store.initialize();
    next();
  });

  const requireUser = route(async (request, response, next) => {
    const token = getSessionToken(request);
    const session = token ? await store.getSession(hashSessionToken(token)) : null;
    if (!session) {
      return response.status(401).json({ error: 'Please log in to continue.' });
    }

    request.user = session.user;
    return next();
  });

  function validateEmail(email) {
    return typeof email === 'string' && email.length <= 254 && validEmail.test(email.trim());
  }

  router.get('/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  router.get('/cars', (request, response) => {
    response.json(cars);
  });

  router.get('/session', requireDatabase, route(async (request, response) => {
    const token = getSessionToken(request);
    const session = token ? await store.getSession(hashSessionToken(token)) : null;
    response.json({ user: session ? publicUser(session.user) : null });
  }));

  router.post('/signup', requireDatabase, route(async (request, response) => {
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

    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await scryptAsync(password, salt, 64)).toString('hex');
    const user = {
      name: name.trim(),
      email: normalizedEmail,
      salt,
      passwordHash
    };
    if (!(await store.createUser(user))) {
      return response.status(409).json({ error: 'An account with this email already exists.' });
    }

    await startSession(response, user);
    return response.status(201).json({ user: publicUser(user) });
  }));

  router.post('/login', requireDatabase, route(async (request, response) => {
    const { email, password } = request.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validateEmail(normalizedEmail) || typeof password !== 'string' || password.length > 128) {
      return response.status(400).json({ error: 'Enter a valid email address and password.' });
    }

    const user = await store.getUser(normalizedEmail);
    if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' });

    const attemptedHash = await scryptAsync(password, user.salt, 64);
    const savedHash = Buffer.from(user.passwordHash, 'hex');
    if (savedHash.length !== attemptedHash.length || !timingSafeEqual(savedHash, attemptedHash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }

    await startSession(response, user);
    return response.json({ user: publicUser(user) });
  }));

  router.post('/logout', requireDatabase, route(async (request, response) => {
    const token = getSessionToken(request);
    if (token) await store.deleteSession(hashSessionToken(token));
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader(
      'Set-Cookie',
      `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
    );
    return response.json({ message: 'You have been logged out.' });
  }));

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

  router.get('/delivery-requests', requireDatabase, requireUser, route(async (request, response) => {
    const orders = await store.listOrders(request.user.email);
    response.json({ orders: orders.map(publicOrder) });
  }));

  router.post('/delivery-requests', requireDatabase, requireUser, route(async (request, response) => {
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
    const order = await store.createOrder({
      id: `V-${randomUUID()}`,
      ownerEmail: request.user.email,
      cars: selectedCars.map(car => car.name),
      total: selectedCars.reduce((sum, car) => sum + car.price, 0),
      address: address.trim(),
      status: 'requested',
      createdAt: new Date().toISOString()
    });
    return response.status(201).json(publicOrder(order));
  }));

  router.patch(
    '/delivery-requests/:id/cancel',
    requireDatabase,
    requireUser,
    route(async (request, response) => {
      const result = await store.cancelOrder(request.params.id, request.user.email);
      if (!result) {
        return response.status(404).json({ error: 'Delivery request not found.' });
      }
      if (result.alreadyCancelled) {
        return response.status(409).json({ error: 'This delivery request has already been cancelled.' });
      }

      return response.json(publicOrder(result.order));
    })
  );

  router.use((error, request, response, next) => {
    console.error('Showroom API request failed:', error);
    if (response.headersSent) return next(error);
    return response.status(503).json({
      error: 'The service is temporarily unavailable. Check the API and database configuration.'
    });
  });

  return router;
}

module.exports = { createApiRouter };
