const express = require('express');
const schedule = require('node-schedule');
const { authMiddleware } = require('./auth')

const router = express.Router();

let displaySurvey = false;

router.get('/displaySurvey', (req, res) => {
  res.json({ displaySurvey });
});

router.post('/displaySurvey', authMiddleware, (req, res) => {
  const { newValue } = req.body;
  if (typeof newValue !== 'boolean') {
    return res.status(400).send('New value must be a boolean.');
  }
  displaySurvey = newValue;
  res.send(`displaySurvey updated to ${displaySurvey}`);
});

// Schedule to reset displaySurvey every day at 6pm
schedule.scheduleJob('0 19 * * *', function(){
  console.log('Resetting displaySurvey to false');
  displaySurvey = false;
});

module.exports = router;