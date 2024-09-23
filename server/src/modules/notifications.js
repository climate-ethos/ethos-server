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

/**
 * Function to register push notification identity with Twilio
 * @param {string} identity The identity used to identify the user
 * @param {string} address The APN device token for IOS notifications
 * @param {string} device The device type ('android' or 'ios' or undefined)
 */
const registerDevice = async (identity, address, device) => {
  const binding = {
    identity: identity,
    // Default to IOS if no device is specified
    // 'fcm' = firebase cloud messaging (android)
    // 'apn' = apple push notification service (IOS)
    bindingType: device === 'android' ? 'fcm' : 'apn',
    address: address
  }
  try {
    const twilioBinding = await client.notify.v1.services(notifyServiceSid)
      .bindings
      .create(binding);
    console.log('Successfully created binding:', twilioBinding);
    return twilioBinding;
  } catch (error) {
    console.error('Error creating binding:', error);
    throw error;
  }
}

/**
 * Function to send Push Notification via Twilio Notify
 * @param {*} identity The identifier for the user
 * @param {*} message The message to send in the push notification
 */
const sendPushNotification = async (identity, message) => {
  try {
    const notification = await client.notify.v1.services(notifyServiceSid)
      .notifications
      .create({
        identity: identity,
        body: message,
      });
    console.log('Push notification sent with SID:', notification.sid);
    return notification;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

// Function to send SMS via Twilio
/**
 *
 * @param {string} to The phone number to send the SMS to
 * @param {string} message The message to send as part of the text
 */
const sendSMS = async (to, message) => {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });
    console.log('SMS sent with SID:', sms.sid);
    return sms;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

router.post('/registerDevice', authMiddleware, async (req, res) => {
  const { identity, address, device } = req.body;
  if (typeof identity !== 'string'
    || typeof address !== 'string'
    || (device !== 'android' && device !== 'ios' && device !== undefined)) {
    return res.status(400).send('Incorrect body parameters');
  }
  try {
    await registerDevice(identity, address, device);
    return res.send('Registered device!');
  } catch (error) {
    return res.status(500).send(`Error registering device: ${error.message}`);
  }
});

router.post('/sendPushNotification', authMiddleware, async (req, res) => {
  const { identity, roomName } = req.body;
  if (typeof identity !== 'string'
    || typeof roomName !== 'string') {
    return res.status(400).send('Incorrect body parameters');
  }
  const message = `There is a high severity heat alert in the ${roomName} area`
  try {
    await sendPushNotification(identity, message);
    return res.send('Push notification sent!');
  } catch (error) {
    return res.status(500).send(`Error sending push notification: ${error.message}`);
  }
});

router.post('/sendSMSNotification', authMiddleware, async (req, res) => {
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
  try {
    await sendSMS(phoneNumber, message);
    return res.send('Text message notification sent!');
  } catch (error) {
    return res.status(500).send(`Error sending SMS notification: ${error.message}`);
  }
});

module.exports = {
  router,
  sendPushNotification,
  sendSMS
};