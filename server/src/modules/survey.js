const express = require('express');
const schedule = require('node-schedule');
const Redis = require('ioredis');
const { authMiddleware, authMiddlewareCouchDB } = require('./auth')

const router = express.Router();

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  // Enable retry strategy
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Redis key prefixes
const GLOBAL_SURVEY_KEY = 'survey:global';
const USER_SURVEY_PREFIX = 'survey:user:';

// Handle Redis connection events
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Connected to Redis successfully');
});

// Helper functions for Redis operations
async function getGlobalSurveyState() {
  const value = await redis.get(GLOBAL_SURVEY_KEY);
  return value === 'true';
}

async function setGlobalSurveyState(value) {
  await redis.set(GLOBAL_SURVEY_KEY, value.toString());
}

async function getUserSurveyState(userId) {
  const value = await redis.get(`${USER_SURVEY_PREFIX}${userId}`);
  return value === 'true';
}

async function setUserSurveyState(userId, value) {
  await redis.set(`${USER_SURVEY_PREFIX}${userId}`, value.toString());
}

// async function resetAllUserSurveys() {
//   // Get all user survey keys
//   const keys = await redis.keys(`${USER_SURVEY_PREFIX}*`);
//   if (keys.length > 0) {
//     // Delete all user survey keys
//     await redis.del(...keys);
//   }
//   // Reset global survey state
//   await setGlobalSurveyState(false);
// }

router.get('/displaySurvey', async (req, res) => {
  try {
    const displaySurvey = await getGlobalSurveyState();
    res.json({ displaySurvey });
  } catch (error) {
    console.error('Error getting global survey state:', error);
    res.status(500).send('Internal server error');
  }
});

router.post('/displaySurvey', authMiddleware, async (req, res) => {
  const { newValue } = req.body;

  if (typeof newValue !== 'boolean') {
    console.error('Unable to set displaySurvey value to:', newValue);
    return res.status(400).send('New value must be a boolean.');
  }

  try {
    await setGlobalSurveyState(newValue);
    console.log('Setting displaySurvey value to:', newValue);
    res.send(`displaySurvey updated to ${newValue}`);
  } catch (error) {
    console.error('Error setting global survey state:', error);
    res.status(500).send('Internal server error');
  }
});

router.get('/displayUserSurvey', authMiddlewareCouchDB, async (req, res) => {
  const userId = req.authenticatedUser;

  try {
    const displaySurvey = await getUserSurveyState(userId);
    res.json({ displaySurvey });
  } catch (error) {
    console.error('Error getting user survey state:', error);
    res.status(500).send('Internal server error');
  }
});

router.post('/displayUserSurvey', authMiddlewareCouchDB, async (req, res) => {
  const userId = req.authenticatedUser;
  const { newValue } = req.body;

  if (typeof newValue !== 'boolean') {
    console.error('Unable to set user survey value to:', newValue, 'for user:', userId);
    return res.status(400).send('New value must be a boolean.');
  }

  try {
    await setUserSurveyState(userId, newValue);
    console.log('Setting survey display value to:', newValue, 'for user:', userId);
    res.send(`Survey display value updated to ${newValue} for user ${userId}`);
  } catch (error) {
    console.error('Error setting user survey state:', error);
    res.status(500).send('Internal server error');
  }
});

// Modified schedule job to use Redis
const scheduleResetJob = () => {
  console.log('Scheduling job to reset survey each day');
  // Reset every day at 11pm
  schedule.scheduleJob('0 23 * * *', async function() {
    try {
      console.log('Resetting BOM survey value');
      await setGlobalSurveyState(false);
      console.log('Successfully reset BOM survey state');
    } catch (error) {
      console.error('Error resetting BOM survey state:', error);
    }
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Redis connection...');
  await redis.quit();
  process.exit(0);
});

module.exports = { router, scheduleResetJob };