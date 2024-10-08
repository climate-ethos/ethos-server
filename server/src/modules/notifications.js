require('dotenv').config();
const twilio = require('twilio');
const express = require('express');

const router = express.Router();
const { authMiddlewareCouchDB } = require('./auth')

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const notifyServiceSid = process.env.TWILIO_NOTIFY_SERVICE_SID;
const client = new twilio(accountSid, authToken);

// Tag to use for research participants (i.e. those who will be receiving surveys)
const RESEARCH_PARTICIPANT_TAG = 'research_participant'

/**
 * Function to register push notification identity with Twilio
 * @param {string} identity The identity used to identify the user
 * @param {string} address The APN device token for IOS notifications
 * @param {string} device The device type ('android' or 'ios' or undefined)
 */
const registerDevice = async (identity, address, tag, device) => {
  const binding = {
    identity: identity,
    // Default to IOS if no device is specified
    // 'fcm' = firebase cloud messaging (android)
    // 'apn' = apple push notification service (IOS)
    bindingType: device === 'android' ? 'fcm' : 'apn',
    address: address
  }
  if (tag === RESEARCH_PARTICIPANT_TAG) {
    binding.tags = [tag]
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
 * Function to remove a registered device from Twilio
 * @param {string} identity The identity of the user
 * @param {string} address The address to remove
 * @returns true when the device is successfully removed
 */
const removeDevice = async (identity, address) => {
  try {
    // Find the binding SID for the given identity and address
    const bindings = await client.notify.v1.services(notifyServiceSid)
      .bindings
      .list({identity: identity});

    const bindingToRemove = bindings.find(binding => binding.address === address);

    if (!bindingToRemove) {
      throw new Error('No binding found for the given identity and address');
    }

    // Remove the binding sid
    await client.notify.v1.services(notifyServiceSid)
      .bindings(bindingToRemove.sid)
      .remove();

    console.log('Successfully removed binding for:', identity, address);
    return true;
  } catch (error) {
    console.error('Error removing binding:', error);
    throw error;
  }
}

/**
 * Function to send Push Notification via Twilio Notify
 * @param {*} identity The identifier for the user
 * @param {*} message The message to send in the push notification
 */
const sendPushNotification = async (identity, message, tag) => {
  const notification = {
    identity: [identity],
    body: message,
  };
  if (tag === RESEARCH_PARTICIPANT_TAG) {
    // Add tag to notification if specified
    notification.tags = [tag];
  }
  try {
    const twilioNotification = await client.notify.v1.services(notifyServiceSid)
      .notifications
      .create(notification);
    console.log('Push notification sent with SID:', twilioNotification.sid);
    return twilioNotification;
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

router.post('/registerDevice', authMiddlewareCouchDB, async (req, res) => {
  const { identity, address, tag, device } = req.body;
  if (typeof identity !== 'string'
    || typeof address !== 'string'
    || (tag !== RESEARCH_PARTICIPANT_TAG && tag !== undefined)
    || (device !== 'android' && device !== 'ios' && device !== undefined)) {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided identity matches the authenticated user
  if (identity !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  try {
    await registerDevice(identity, address, tag, device);
    return res.send('Registered device!');
  } catch (error) {
    return res.status(500).send(`Error registering device: ${error.message}`);
  }
});

router.post('/removeDevice', authMiddlewareCouchDB, async (req, res) => {
  const { identity, address } = req.body;
  if (typeof identity !== 'string' || typeof address !== 'string') {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided identity matches the authenticated user
  if (identity !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  try {
    await removeDevice(identity, address);
    return res.send('Device removed successfully');
  } catch (error) {
    return res.status(500).send(`Error removing device: ${error.message}`);
  }
});

router.post('/sendAlertPushNotification', authMiddlewareCouchDB, async (req, res) => {
  const { identity, roomName, severity } = req.body;
  if (typeof identity !== 'string'
    || typeof roomName !== 'string'
    || (severity !== 'medium' && severity !== 'high')) {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided identity matches the authenticated user
  if (identity !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  const message = (severity === 'medium' ? '🟡' : '🔴') + ` There is a ${severity} severity heat alert in the ${roomName} area`
  try {
    await sendPushNotification(identity, message);
    return res.send('Push notification sent!');
  } catch (error) {
    return res.status(500).send(`Error sending push notification: ${error.message}`);
  }
});

router.post('/sendSurveyPushNotification', authMiddlewareCouchDB, async (req, res) => {
  const { identity, surveyType } = req.body;
  if (typeof identity !== 'string'
    || (surveyType !== 'bom' && surveyType !== 'alert' && surveyType !== 'both')) {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided identity matches the authenticated user
  if (identity !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  // Default to both survey message
  let message = "Survey: There is a BOM survey and heat alert survey awaiting completion"
  if (surveyType === 'bom') {
    // BOM survey message
    message = "Survey: There is a BOM survey awaiting completion"
  } else if (surveyType === 'alert') {
    // Heat alert survey message
    message = "Survey: There is a heat alert survey awaiting completion"
  }
  try {
    await sendPushNotification(identity, message, RESEARCH_PARTICIPANT_TAG);
    return res.send('Push notification sent!');
  } catch (error) {
    return res.status(500).send(`Error sending push notification: ${error.message}`);
  }
});

// Endpoint to send Fitbit push notification to research participants
router.post('/sendFitbitPushNotification', authMiddlewareCouchDB, async (req, res) => {
  const { identity } = req.body;

  if (typeof identity !== 'string') {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided identity matches the authenticated user
  if (identity !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  const message = "Reminder: Please charge your Fitbit device and sync it with the app to ensure accurate data collection.";

  try {
    // Send push notification to the participant with RESEARCH_PARTICIPANT_TAG
    const notification = await sendPushNotification(identity, message, RESEARCH_PARTICIPANT_TAG);
    console.log('Fitbit reminder push notification sent:', notification.sid);
    return res.send('Fitbit push notification sent!');
  } catch (error) {
    console.error('Error sending Fitbit push notification:', error);
    return res.status(500).send(`Error sending Fitbit push notification: ${error.message}`);
  }
});

router.post('/sendSMSNotification', authMiddlewareCouchDB, async (req, res) => {
  const { userId, phoneNumber, roomName, severity } = req.body;
  if (
    (typeof userId !== 'string' && typeof userId !== 'number') ||
    typeof phoneNumber !== 'string' ||
    typeof roomName !== 'string' ||
    (severity !== 'medium' && severity !== 'high')
  ) {
    return res.status(400).send('Incorrect body parameters');
  }

  // Check if the provided userId matches the authenticated user
  if (userId !== req.authenticatedUser) {
    return res.status(403).send('Identity does not match authenticated user');
  }

  const message = `User ${userId} has recorded a ${severity} severity heat alert in the ${roomName} area`
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