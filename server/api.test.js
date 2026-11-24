const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const { createApiRouter } = require('./api');

let server;
let baseUrl;

function createTestStore() {
  const users = new Map();
  const sessions = new Map();
  const orders = new Map();

  return {
    async initialize() {},
    async createUser(user) {
      if (users.has(user.email)) return false;
      users.set(user.email, user);
      return true;
    },
    async getUser(email) {
      return users.get(email) || null;
    },
    async createSession(tokenHash, email, expiresAt) {
      sessions.set(tokenHash, { email, expiresAt: new Date(expiresAt).getTime() });
    },
    async getSession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= Date.now()) return null;
      const user = users.get(session.email);
      return user ? { user: { name: user.name, email: user.email }, expiresAt: session.expiresAt } : null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async createOrder(order) {
      orders.set(order.id, order);
      return order;
    },
    async listOrders(ownerEmail) {
      return [...orders.values()]
        .filter(order => order.ownerEmail === ownerEmail)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async cancelOrder(id, ownerEmail) {
      const order = orders.get(id);
      if (!order || order.ownerEmail !== ownerEmail) return null;
      if (order.status === 'cancelled') return { order, alreadyCancelled: true };
      order.status = 'cancelled';
      return { order, alreadyCancelled: false };
    }
  };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter({ store: createTestStore() }));
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function createAccount(email, name = 'Test Driver') {
  const response = await request('/signup', {
    method: 'POST',
    body: { name, email, password: 'secure-password-1' }
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  return { response, cookie };
}

test('returns the showroom inventory', async () => {
  const response = await request('/cars');
  const cars = await response.json();

  assert.equal(response.status, 200);
  assert.equal(cars.length, 3);
  assert.equal(cars[0].id, 'aston-dbs');
});

test('rejects invalid service requests', async () => {
  const response = await request('/service-requests', {
    method: 'POST',
    body: { name: '', email: 'not-an-email', message: '' }
  });

  assert.equal(response.status, 400);
});

test('returns a JSON configuration error when the database is unavailable', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter({
    store: { async initialize() { throw new Error('DATABASE_URL is not configured.'); } }
  }));
  const temporaryServer = app.listen(0);
  await new Promise(resolve => temporaryServer.once('listening', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${temporaryServer.address().port}/api/session`);
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.match(result.error, /temporarily unavailable/);
  } finally {
    await new Promise((resolve, reject) => {
      temporaryServer.close(error => error ? reject(error) : resolve());
    });
  }
});

test('validates signup, hashes credentials, and creates a session', async () => {
  const invalid = await request('/signup', {
    method: 'POST',
    body: { name: 'Test Driver', email: 'driver@example.com', password: 'short' }
  });
  assert.equal(invalid.status, 400);

  const { response, cookie } = await createAccount(' DRIVER@example.com ');
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await response.json()).user.email, 'driver@example.com');

  const session = await request('/session', { cookie });
  assert.equal((await session.json()).user.name, 'Test Driver');
});

test('rejects duplicate accounts and incorrect passwords', async () => {
  const email = 'duplicate@example.com';
  const created = await createAccount(email);
  assert.equal(created.response.status, 201);

  const duplicate = await createAccount(email);
  assert.equal(duplicate.response.status, 409);

  const login = await request('/login', {
    method: 'POST',
    body: { email, password: 'not-the-password' }
  });
  assert.equal(login.status, 401);
});

test('logs in existing users and invalidates their sessions on logout', async () => {
  const email = 'login@example.com';
  const created = await createAccount(email);
  assert.equal(created.response.status, 201);

  const login = await request('/login', {
    method: 'POST',
    body: { email, password: 'secure-password-1' }
  });
  const loginCookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.equal(login.status, 200);
  assert.equal((await request('/session', { cookie: loginCookie })).status, 200);

  const logout = await request('/logout', { method: 'POST', cookie: loginCookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  const sessionAfterLogout = await request('/session', { cookie: loginCookie });
  assert.equal((await sessionAfterLogout.json()).user, null);
});

test('requires a signed-in user to place an order', async () => {
  const response = await request('/delivery-requests', {
    method: 'POST',
    body: { address: '1 Test Street', carIds: ['aston-dbs'] }
  });

  assert.equal(response.status, 401);
});

test('places orders using catalog prices and allows the owner to cancel', async () => {
  const { cookie, response: signup } = await createAccount('owner@example.com');
  assert.equal(signup.status, 201);

  const response = await request('/delivery-requests', {
    method: 'POST',
    cookie,
    body: {
      address: '1 Test Street',
      carIds: ['aston-dbs'],
      total: 1
    }
  });
  const order = await response.json();

  assert.equal(response.status, 201);
  assert.equal(order.total, 316300);
  assert.deepEqual(order.cars, ['Aston Martin DBS']);
  assert.equal(order.status, 'requested');
  assert.equal('address' in order, false);

  const otherUser = await createAccount('other-owner@example.com');
  const forbiddenCancel = await request(`/delivery-requests/${order.id}/cancel`, {
    method: 'PATCH',
    cookie: otherUser.cookie
  });
  assert.equal(forbiddenCancel.status, 404);

  const cancel = await request(`/delivery-requests/${order.id}/cancel`, {
    method: 'PATCH',
    cookie
  });
  assert.equal((await cancel.json()).status, 'cancelled');

  const repeatCancel = await request(`/delivery-requests/${order.id}/cancel`, {
    method: 'PATCH',
    cookie
  });
  assert.equal(repeatCancel.status, 409);

  const list = await request('/delivery-requests', { cookie });
  assert.equal((await list.json()).orders[0].status, 'cancelled');
});
