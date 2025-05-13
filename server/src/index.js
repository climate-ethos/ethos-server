require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { router: surveyRoutes, scheduleResetJob } = require('./modules/survey');
const { router: notificationRoutes } = require('./modules/notifications');

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Use survey routes
app.use('/', surveyRoutes);
app.use('/', notificationRoutes);

// Schedule job to reset survey each day
scheduleResetJob();

const PORT = 8080; // Your app will always listen on HTTP on this port

// Always create an HTTP server. Nginx handles HTTPS.
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`HTTP Development Server running on port ${PORT}`);
  } else {
    console.log(`HTTP Production Server (behind Nginx) running on port ${PORT}`);
  }
});