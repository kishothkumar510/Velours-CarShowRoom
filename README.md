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

This project has no database configured: accounts, sessions, and orders are
kept in server memory and are cleared when the API server restarts. The cart is
stored in the browser's local storage.
