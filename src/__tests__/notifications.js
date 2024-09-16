const request = require('supertest');
const express = require('express');

jest.mock('twilio', () => {
  const mockCreateNotification = jest.fn().mockResolvedValue({ sid: 'test-sid' });
  const mockCreateSMS = jest.fn().mockResolvedValue({ sid: 'test-sid' });

  return jest.fn(() => ({
    notify: {
      v1: {
        services: jest.fn(() => ({
          notifications: {
            create: mockCreateNotification,
          },
        })),
      },
    },
    messages: {
      create: mockCreateSMS,
    },
  }));
});

const {
  router,
  sendPushNotification,
  sendSMS
} = require('../modules/notifications');

const twilio = require('twilio');

jest.mock('../modules/auth', () => ({
  authMiddleware: (req, res, next) => next(),
}));

// Mock environment variables
process.env.TWILIO_PHONE_NUMBER = '+19314002393';

const app = express();
app.use(express.json());
app.use(router);

describe('Notification Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /sendPushNotification', () => {
    it('should send a push notification and return 200', async () => {
      const response = await request(app)
        .post('/sendPushNotification')
        .send({ deviceToken: 'test-token', roomName: 'Living Room' });

      expect(response.status).toBe(200);
      expect(response.text).toBe('Text push notification sent!');
      expect(twilio().notify.v1.services().notifications.create)
        .toHaveBeenCalledWith({
          identity: 'test-token',
          body: 'There is a high severity heat alert in the Living Room area'
        });
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .post('/sendPushNotification')
        .send({ deviceToken: 123, roomName: 'Living Room' });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Incorrect body parameters');
    });
  });

  describe('POST /sendSMSNotification', () => {
    it('should send an SMS notification and return 200', async () => {
      const response = await request(app)
        .post('/sendSMSNotification')
        .send({
          userId: '123',
          phoneNumber: '+1234567890',
          roomName: 'Bedroom',
          severity: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('Text message notification sent!');
      expect(twilio().messages.create).toHaveBeenCalledWith({
        to: '+1234567890',
        from: process.env.TWILIO_PHONE_NUMBER,
        body: 'User 123 has recorded a high severity alert in the Bedroom area'
      });
    });

    it('should return 400 for invalid parameters', async () => {
      const response = await request(app)
        .post('/sendSMSNotification')
        .send({
          userId: '123',
          phoneNumber: 1234567890,
          roomName: 'Bedroom',
          severity: 'high',
        });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Incorrect body parameters');
    });
  });

  describe('sendPushNotification function', () => {
    it('should log success message on successful notification', async () => {
      const mockCreate = twilio().notify.v1.services().notifications.create;
      mockCreate.mockResolvedValue({ sid: 'test-sid' });

      console.log = jest.fn();

      await sendPushNotification('test-identity', 'Test message');

      expect(console.log).toHaveBeenCalledWith('Push notification sent with SID:', 'test-sid');
      expect(mockCreate).toHaveBeenCalledWith({
        identity: 'test-identity',
        body: 'Test message',
      });
    });
  });

  describe('sendSMS function', () => {
    it('should log success message on successful SMS', async () => {
      const mockCreate = twilio().messages.create;
      mockCreate.mockResolvedValue({ sid: 'test-sid' });

      console.log = jest.fn();

      await sendSMS('+1234567890', 'Test message');

      expect(console.log).toHaveBeenCalledWith('SMS sent with SID:', 'test-sid');
      expect(mockCreate).toHaveBeenCalledWith({
        to: '+1234567890',
        from: process.env.TWILIO_PHONE_NUMBER,
        body: 'Test message',
      });
    });
  });
});