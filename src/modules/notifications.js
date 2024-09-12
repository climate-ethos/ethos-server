require('dotenv').config();
const twilio = require('twilio');
const express = require('express');

const router = express.Router();
const { authMiddleware } = require('./auth')

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const notifyServiceSid = process.env.TWILIO_NOTIFY_SERVICE_SID;
const client = new twilio(accountSid, authToken);

// Function to send Push Notification via Twilio Notify
const sendPushNotification = async (identity, message) => {
  try {
    const notification = await client.notify.services(notifyServiceSid).notifications.create({
      identity: identity,
      body: message,
    });
    console.log('Push notification sent with SID:', notification.sid);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

// Function to send SMS via Twilio
const sendSMS = async (to, message) => {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });
    console.log('SMS sent with SID:', sms.sid);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
};

router.post('/sendPushNotification', authMiddleware, (req, res) => {
  const { deviceToken, roomName } = req.body;
  if (typeof deviceToken !== 'string'
    || typeof roomName !== 'string') {
    return res.status(400).send('Incorrect body parameters');
  }
  const message = `There is a high severity heat alert in the ${roomName} area`
  sendPushNotification(deviceToken, message)
  return res.send('Text push notification sent!');
});

router.post('/sendSMSNotification', authMiddleware, (req, res) => {
  const { userId, phoneNumber, roomName, severity } = req.body;
  if (
    (typeof userId !== 'string' && typeof userId !== 'number') ||
    typeof phoneNumber !== 'string' ||
    typeof roomName !== 'string' ||
    typeof severity !== 'string'
  ) {
    return res.status(400).send('Incorrect body parameters');
  }
  const message = `User ${userId} has recorded a ${severity} severity alert in the ${roomName} area`
  sendSMS(phoneNumber, message)
  return res.send('Text message notification sent!');
});

module.exports = router;
