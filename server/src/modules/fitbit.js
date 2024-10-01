require('dotenv').config();
const express = require('express');

const router = express.Router();

const crypto = require('crypto');
const querystring = require('querystring');

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

  // Store the code verifier in the session (for simplicity, we're using a global variable)
  global.codeVerifier = codeVerifier;

  const authorizationUrl = `https://www.fitbit.com/oauth2/authorize?${querystring.stringify({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'activity heartrate sleep temperature'
  })}`;

  res.send(`<a href="${authorizationUrl}">Authorize with Fitbit</a>`);
});

router.get('/fitbit-callback', async (req, res) => {
  const { code } = req.query;
  const codeVerifier = global.codeVerifier;

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

    const { user_id, access_token, expires_in, refresh_token } = tokenResponse.data;

    // TODO: store these tokens securely for future use
    res.send(`Authorization successful! User ID: ${user_id}`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response ? error.response.data : error.message);
    res.status(500).send('Error obtaining access token');
  }
});


module.exports = {
  router
};