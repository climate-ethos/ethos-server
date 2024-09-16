const request = require('supertest');
const express = require('express');
const schedule = require('node-schedule');
const { router, scheduleResetJob } = require('../modules/survey');
const { authMiddleware } = require('../modules/auth');

jest.mock('node-schedule');
jest.mock('../modules/auth');

describe('Survey Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(router);

    // Spy on scheduleJob to ensure it's being called
    jest.spyOn(schedule, 'scheduleJob');

    // Call the function to schedule the job
    scheduleResetJob();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /displaySurvey', () => {
    it('should return the current displaySurvey value', async () => {
      const response = await request(app).get('/displaySurvey');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ displaySurvey: false });
    });
  });

  describe('POST /displaySurvey', () => {
    it('should update displaySurvey value when authorized', async () => {
      authMiddleware.mockImplementation((req, res, next) => next());

      const response = await request(app)
        .post('/displaySurvey')
        .send({ newValue: true });

      expect(response.status).toBe(200);
      expect(response.text).toBe('displaySurvey updated to true');

      const getResponse = await request(app).get('/displaySurvey');
      expect(getResponse.body).toEqual({ displaySurvey: true });
    });

    it('should return 401 when unauthorized', async () => {
      authMiddleware.mockImplementation((req, res, next) => res.status(401).send('Unauthorized'));

      const response = await request(app)
        .post('/displaySurvey')
        .send({ newValue: true });

      expect(response.status).toBe(401);
      expect(response.text).toBe('Unauthorized');
    });

    it('should return 400 when newValue is not a boolean', async () => {
      authMiddleware.mockImplementation((req, res, next) => next());

      const response = await request(app)
        .post('/displaySurvey')
        .send({ newValue: 'not a boolean' });

      expect(response.status).toBe(400);
      expect(response.text).toBe('New value must be a boolean.');
    });
  });

  describe('Scheduled job', () => {
    it('should schedule a job to reset displaySurvey', () => {
      // Check if scheduleJob was called
      expect(schedule.scheduleJob).toHaveBeenCalledWith('0 19 * * *', expect.any(Function));
    });

    it('should reset displaySurvey to false when job runs', async () => {
      const job = schedule.scheduleJob.mock.calls[0][1];

      // Set displaySurvey to true
      await request(app)
        .post('/displaySurvey')
        .send({ newValue: true });

      // Run the scheduled job
      job();

      // Check if displaySurvey is reset to false
      const response = await request(app).get('/displaySurvey');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ displaySurvey: false });
    });
  });
});
