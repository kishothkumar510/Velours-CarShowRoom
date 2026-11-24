# Velours car showroom

The showroom uses React for its pages and an Express server for the API. Run
these commands from this project folder with Node.js 18 or newer installed.

## Install

```powershell
npm install
```

## Run in development

Open two terminals in the project folder:

1. Start the API:

   ```powershell
   npm run server
   ```

2. Start the React development site:

   ```powershell
   npm run dev
   ```

Open the address printed by Vite, usually `http://localhost:5173`. The Vite
development server forwards `/api` requests to the Express server on port 3001.

## Configure Neon for accounts and orders

Create a PostgreSQL database in Neon and copy its connection string. Set it as
`DATABASE_URL` in the Vercel project settings under **Settings → Environment
Variables**, for Preview and Production. Do not commit the connection string.
Redeploy after adding it. The API creates its tables automatically the first
time it connects.

Vercel serves the React app and `/cart` and `/inventory` routes from `dist`,
and runs the JSON API through `api/[...route].js`.

For local development, set `DATABASE_URL` in the terminal before starting the
API server:

```powershell
$env:DATABASE_URL = "your Neon PostgreSQL connection string"
npm run server
```

The database URL must allow SSL connections. Without it, account and order API
routes return a JSON configuration error rather than an HTML page.

## Build and run the production version

```powershell
npm run build
npm start
```

Open `http://localhost:3001`. Express serves the built React site and its API.

## Tests

```powershell
npm test
```

Sign up and log in from the site header. Passwords are hashed by Node.js, and
the server uses an HTTP-only session cookie. Orders require an account; signed-in
users can place and cancel their own orders from the cart page.

Accounts, hashed passwords, sessions, and orders are stored in Neon Postgres.
The cart is stored in the browser's local storage.
