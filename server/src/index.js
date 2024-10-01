require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const { router: surveyRoutes, scheduleResetJob } = require('./modules/survey');
const { router: notificationRoutes } = require('./modules/notifications');
const { router: fitbitRoutes } = require('./modules/fitbit');

const isDev = process.env.NODE_ENV === 'development';
let credentials;
if (!isDev) {
  // Read the SSL certificate and private key
  const domainName = process.env.DOMAIN_NAME;
  const privateKey = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/privkey.pem`);
  const certificate = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/fullchain.pem`);
  credentials = { key: privateKey, cert: certificate };
}

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Use survey routes
app.use('/', surveyRoutes);
app.use('/', notificationRoutes);
app.use('/', fitbitRoutes);

// Schedule job to reset survey each day
scheduleResetJob();

const PORT = 8080;
if (!isDev) {
  // Create HTTPS server in production
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(PORT, () => {
    console.log(`HTTPS Server running on port ${PORT}`);
  });
} else {
  // Create HTTP server in development
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
  });
}