require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const auth = require('basic-auth');
const cors = require('cors');
const schedule = require('node-schedule');

// Read the SSL certificate and private key
const domainName = process.env.DOMAIN_NAME;
const privateKey = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/privkey.pem`);
const certificate = fs.readFileSync(`/etc/letsencrypt/live/${domainName}/fullchain.pem`);
const credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

/**
 * Main variable to control whether to show BOM survey
 */
let displaySurvey = false;

/**
 * Basic Authentication middleware fucntion
 */
const authMiddleware = (req, res, next) => {
  const user = auth(req);
  if (!user || user.name !== process.env.USERNAME || user.pass !== process.env.PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
    return;
  }
  next();
};

/**
 * Endpoint for getting the current status of whether BOM survey should be displayed
 */
app.get('/displaySurvey', (req, res) => {
  res.json({ displaySurvey });
});

/**
 * Endpoint for setting current status of whether BOM survey should be displayed
 */
app.post('/displaySurvey', authMiddleware, (req, res) => {
  const { newValue } = req.body;
  if (typeof newValue !== 'boolean') {
    return res.status(400).send('New value must be a boolean.');
  }
  displaySurvey = newValue;
  res.send(`displaySurvey updated to ${displaySurvey}`);
});

// Schedule to reset displaySurvey every day at 6pm
schedule.scheduleJob('0 18 * * *', function(){
  console.log('Resetting displaySurvey to false');
  displaySurvey = false;
});

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);
const PORT = 8080;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});