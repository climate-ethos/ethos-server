const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
require('dotenv').config();

const domainName = process.env.DOMAIN_NAME;

// Load the Certbot SSL certificate and private key
const server = https.createServer({
  cert: fs.readFileSync(`/etc/letsencrypt/live/${domainName}/fullchain.pem`),
  key: fs.readFileSync(`/etc/letsencrypt/live/${domainName}/privkey.pem`)
});

// Create websocket server
const wss = new WebSocket.Server({ server });

// Store all connected clients
const clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);

  ws.on('close', () => {
    const index = clients.indexOf(ws);
    if (index > -1) {
      clients.splice(index, 1);
    }
  });
});

// Listen for terminal input
process.on('SIGUSR1', () => {
  clients.forEach(client => client.send('displaySurvey'));
  console.log('Sent displaySurvey to all connected clients.');
});

// Start the server on port 8080
server.listen(8080, () => {
  console.log('Server is running on port 8080');
});