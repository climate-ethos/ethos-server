require('dotenv').config();
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const querystring = require('querystring');
const axios = require('axios');
const Redis = require('ioredis');

const { authMiddleware } = require('./auth')

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
    await redis.hmset(`user:${user_id}`, {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    });

    // Delete the code verifier
    await redis.del(`codeVerifier:${req.ip}`);

    res.send(`Authorization successful! User ID: ${user_id}`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response ? error.response.data : error.message);
    res.status(500).send('Error obtaining access token');
  }
});

// Helper function to get tokens for a user
async function getTokens(userId) {
  return redis.hgetall(`user:${userId}`);
}

// Helper function to update tokens for a user
async function updateTokens(userId, newTokens) {
  await redis.hmset(`user:${userId}`, newTokens);
}

// Function to refresh the access token
async function refreshAccessToken(userId, refreshToken) {
  try {
    const response = await axios.post(
      'https://api.fitbit.com/oauth2/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    await updateTokens(userId, {
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
    });

    return access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Middleware to check and refresh token if necessary
async function ensureValidToken(req, res, next) {
  const userId = req.params.userId; // Assuming the user ID is passed as a route parameter
  const tokens = await getTokens(userId);

  if (!tokens) {
    return res.status(401).send('User not authenticated');
  }

  const now = new Date();
  const expiresAt = new Date(tokens.expires_at);

  if (now >= expiresAt) {
    try {
      const newAccessToken = await refreshAccessToken(userId, tokens.refresh_token);
      req.accessToken = newAccessToken;
    } catch (error) {
      return res.status(401).send('Failed to refresh token');
    }
  } else {
    req.accessToken = tokens.access_token;
  }

  next();
}

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

module.exports = {
  router
};