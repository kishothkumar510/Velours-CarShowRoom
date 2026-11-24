const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { createApiRouter } = require('./api');

const app = express();
const distPath = path.join(__dirname, '..', 'dist');

app.use(express.json({ limit: '16kb' }));
app.use('/api', createApiRouter());

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/') || path.extname(request.path)) {
      return next();
    }

    response.sendFile(path.join(distPath, 'index.html'));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Velours server listening on http://localhost:${port}`);
});