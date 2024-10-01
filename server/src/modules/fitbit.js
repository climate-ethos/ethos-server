require('dotenv').config();
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const querystring = require('querystring');
const axios = require('axios');
const Redis = require('ioredis');

const { authMiddleware } = require('./auth')
const { getValidToken, updateTokens, ensureValidToken } = require('./fitbit-helpers')

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL);

// Generate a code verifier
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate a code challenge from the code verifier
function generateCodeChallenge(codeVerifier) {
  const base64Digest = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64');
  return base64Digest
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

router.get('/fitbit', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store the code verifier in Redis with a short expiration
  redis.set(`codeVerifier:${req.ip}`, codeVerifier, 'EX', 30 * 60); // Expires in 30 minutes

  const authorizationUrl = `https://www.fitbit.com/oauth2/authorize?${querystring.stringify({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'activity heartrate sleep temperature settings'
  })}`;

  res.send(`<a href="${authorizationUrl}">Authorize with Fitbit</a>`);
});

router.get('/fitbit-callback', async (req, res) => {
  const { code } = req.query;
  const codeVerifier = await redis.get(`codeVerifier:${req.ip}`);

  if (!codeVerifier) {
    return res.status(400).send('Code verifier expired or not found');
  }

  try {
    const tokenResponse = await axios.post(
      'https://api.fitbit.com/oauth2/token',
      querystring.stringify({
        client_id: process.env.CLIENT_ID,
        code: code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    const { user_id, access_token, refresh_token, expires_in} = tokenResponse.data;

    // Store tokens in Redis
    updateTokens(user_id, {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    })

    // Delete the code verifier
    await redis.del(`codeVerifier:${req.ip}`);

    res.send(`Authorization successful! User ID: ${user_id}`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response ? error.response.data : error.message);
    res.status(500).send('Error obtaining access token');
  }
});

// Get list of devices for a user
router.get('/fitbit/:userId/devices', authMiddleware, ensureValidToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.fitbit.com/1/user/-/devices.json', {
      headers: {
        Authorization: `Bearer ${req.accessToken}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching user profile:', error.response ? error.response.data : error.message);
    res.status(500).send('Error fetching user profile');
  }
});

router.get('/fitbit/all-users', authMiddleware, async (req, res) => {
  try {
    const userKeys = await redis.keys('user:*');
    const userIds = userKeys.map(key => key.split(':')[1]);

    let tableRows = '';

    for (const userId of userIds) {
      try {
        const accessToken = await getValidToken(userId);

        const response = await axios.get('https://api.fitbit.com/1/user/-/devices.json', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        const devicesInfo = response.data.map(device =>
          `${device.deviceVersion} (${device.batteryLevel}%) ${device.lastSyncTime}`
        ).join('\n');

        tableRows += `<tr><td>${userId}</td><td>${devicesInfo}</td></tr>`;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error.message);
        tableRows += `<tr><td>${userId}</td><td>${error.message}</td></tr>`;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Users and Devices</title>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Users and Their Devices</h1>
        <table>
          <tr>
            <th>User ID</th>
            <th>Devices</th>
          </tr>
          ${tableRows}
        </table>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error generating users and devices table:', error.message);
    res.status(500).send('Error generating users and devices table');
  }
});

module.exports = {
  router
};