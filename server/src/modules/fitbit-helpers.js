const querystring = require('querystring');
const axios = require('axios');
const Redis = require('ioredis');

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL);

// Middleware to ensure a valid token
async function ensureValidToken(req, res, next) {
  const userId = req.params.userId; // Assuming the user ID is passed as a route parameter

  try {
    req.accessToken = await getValidToken(userId);
    next();
  } catch (error) {
    res.status(401).send(error.message);
  }
}

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

async function getValidToken(userId) {
  const tokens = await getTokens(userId);

  if (!tokens) {
    throw new Error('User not authenticated');
  }

  const now = new Date();
  const expiresAt = new Date(tokens.expires_at);

  if (now >= expiresAt) {
    try {
      const newAccessToken = await refreshAccessToken(userId, tokens.refresh_token);
      return newAccessToken;
    } catch (error) {
      console.error(`Failed to refresh token for user ${userId}:`, error.message);
      throw new Error('Failed to refresh token');
    }
  } else {
    return tokens.access_token;
  }
}

module.exports = {
  getValidToken,
  updateTokens,
  ensureValidToken
}