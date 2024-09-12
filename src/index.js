require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const surveyRoutes = require('./modules/survey');

// Read the SSL certificate and private key
const domainName = process.env.DOMAIN_NAME;
const privateKey = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/privkey.pem`);
const certificate = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/fullchain.pem`);
const credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Use survey routes
app.use('/', surveyRoutes);

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);
const PORT = 8080;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});