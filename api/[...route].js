const express = require('express');
const { createApiRouter } = require('../server/api');

const app = express();

app.use(express.json({ limit: '16kb' }));
app.use('/api', createApiRouter());

module.exports = app;