const { Pool } = require('pg');

const schema = `
  CREATE TABLE IF NOT EXISTS showroom_users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS showroom_sessions (
    token_hash TEXT PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES showroom_users(email) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS showroom_sessions_expiry_idx
    ON showroom_sessions (expires_at);
  CREATE TABLE IF NOT EXISTS showroom_orders (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL REFERENCES showroom_users(email),
    cars JSONB NOT NULL,
    total NUMERIC NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('requested', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS showroom_orders_owner_idx
    ON showroom_orders (owner_email, created_at DESC);
`;

function mapUser(row) {
  return {
    name: row.name,
    email: row.email,
    salt: row.salt,
    passwordHash: row.password_hash
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    cars: row.cars,
    total: Number(row.total),
    address: row.address,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function createPostgresStore() {
  let pool;
  let initialization;

  function getPool() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured.');
    }

    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: true,
        max: 1,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000
      });
    }

    return pool;
  }

  async function initialize() {
    if (!initialization) {
      initialization = getPool().query(schema).catch(error => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  }

  async function query(text, values) {
    await initialize();
    return getPool().query(text, values);
  }

  return {
    initialize,

    async createUser(user) {
      const result = await query(
        `INSERT INTO showroom_users (email, name, salt, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING email`,
        [user.email, user.name, user.salt, user.passwordHash]
      );
      return result.rowCount === 1;
    },

    async getUser(email) {
      const result = await query(
        'SELECT name, email, salt, password_hash FROM showroom_users WHERE email = $1',
        [email]
      );
      return result.rows[0] ? mapUser(result.rows[0]) : null;
    },

    async createSession(tokenHash, email, expiresAt) {
      await query(
        `INSERT INTO showroom_sessions (token_hash, user_email, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, email, expiresAt]
      );
    },

    async getSession(tokenHash) {
      const result = await query(
        `SELECT u.name, u.email, s.expires_at
         FROM showroom_sessions s
         JOIN showroom_users u ON u.email = s.user_email
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [tokenHash]
      );
      if (!result.rows[0]) {
        await query('DELETE FROM showroom_sessions WHERE token_hash = $1', [tokenHash]);
        return null;
      }

      return {
        user: { name: result.rows[0].name, email: result.rows[0].email },
        expiresAt: new Date(result.rows[0].expires_at).getTime()
      };
    },

    async deleteSession(tokenHash) {
      await query('DELETE FROM showroom_sessions WHERE token_hash = $1', [tokenHash]);
    },

    async createOrder(order) {
      const result = await query(
        `INSERT INTO showroom_orders
           (id, owner_email, cars, total, address, status, created_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         RETURNING *`,
        [
          order.id,
          order.ownerEmail,
          JSON.stringify(order.cars),
          order.total,
          order.address,
          order.status,
          order.createdAt
        ]
      );
      return mapOrder(result.rows[0]);
    },

    async listOrders(ownerEmail) {
      const result = await query(
        'SELECT * FROM showroom_orders WHERE owner_email = $1 ORDER BY created_at DESC',
        [ownerEmail]
      );
      return result.rows.map(mapOrder);
    },

    async cancelOrder(id, ownerEmail) {
      const result = await query(
        `UPDATE showroom_orders
         SET status = 'cancelled'
         WHERE id = $1 AND owner_email = $2 AND status = 'requested'
         RETURNING *`,
        [id, ownerEmail]
      );
      if (result.rows[0]) return { order: mapOrder(result.rows[0]), alreadyCancelled: false };

      const existing = await query(
        'SELECT * FROM showroom_orders WHERE id = $1 AND owner_email = $2',
        [id, ownerEmail]
      );
      if (!existing.rows[0]) return null;
      return { order: mapOrder(existing.rows[0]), alreadyCancelled: true };
    }
  };
}

module.exports = { createPostgresStore };
