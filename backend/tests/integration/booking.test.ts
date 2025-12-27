import request from 'supertest';
import { createTestApp } from '../testApp';

const app = createTestApp();

describe('Booking API Integration', () => {
  describe('GET /api/services', () => {
    it('should return list of services', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return services with required fields', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      const service = response.body[0];
      expect(service).toHaveProperty('id');
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('duration');
      expect(service).toHaveProperty('price');
    });
  });

  describe('GET /api/services/business/info', () => {
    it('should return business information', async () => {
      const response = await request(app)
        .get('/api/services/business/info')
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('phone');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('address');
    });
  });

  describe('GET /api/services/business/hours', () => {
    it('should return business hours', async () => {
      const response = await request(app)
        .get('/api/services/business/hours')
        .expect(200);

      expect(response.body).toHaveProperty('monday');
      expect(response.body).toHaveProperty('sunday');
    });
  });

  describe('GET /api/appointments/slots', () => {
    it('should return slots for valid date and service', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/appointments/slots?date=${dateStr}&serviceId=consultation`)
        .expect(200);

      expect(response.body).toHaveProperty('slots');
      expect(Array.isArray(response.body.slots)).toBe(true);
    });

    it('should return empty slots for past date', async () => {
      const response = await request(app)
        .get('/api/appointments/slots?date=2020-01-01&serviceId=consultation')
        .expect(200);

      expect(response.body.slots).toEqual([]);
    });

    it('should return 400 for missing date', async () => {
      const response = await request(app)
        .get('/api/appointments/slots?serviceId=consultation')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing serviceId', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/appointments/slots?date=${dateStr}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/appointments', () => {
    it('should reject booking with missing fields', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .send({
          customerName: 'Test User'
          // Missing other required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject booking with invalid email', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/appointments')
        .send({
          customerName: 'Test User',
          customerEmail: 'invalid-email',
          customerPhone: '+14155551234',
          serviceId: 'consultation',
          date: dateStr,
          time: '10:00'
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should reject booking for past date', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .send({
          customerName: 'Test User',
          customerEmail: 'test@test.com',
          customerPhone: '+14155551234',
          serviceId: 'consultation',
          date: '2020-01-01',
          time: '10:00'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject booking for invalid service', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/appointments')
        .send({
          customerName: 'Test User',
          customerEmail: 'test@test.com',
          customerPhone: '+14155551234',
          serviceId: 'invalid-service',
          date: dateStr,
          time: '10:00'
        })
        .expect(400);

      expect(response.body.error).toContain('not found');
    });

    it('should create valid booking', async () => {
      // Get available slots first
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const slotsResponse = await request(app)
        .get(`/api/appointments/slots?date=${dateStr}&serviceId=consultation`);

      const availableSlots = slotsResponse.body.slots?.filter((s: { available: boolean }) => s.available) || [];

      if (availableSlots.length > 0) {
        const response = await request(app)
          .post('/api/appointments')
          .send({
            customerName: 'Integration Test User',
            customerEmail: 'integration@test.com',
            customerPhone: '+14155559999',
            serviceId: 'consultation',
            date: dateStr,
            time: availableSlots[0].time
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('serviceName');
        expect(response.body.customerName).toBe('Integration Test User');
        expect(response.body.status).toBe('pending');
      }
    });
  });

  describe('GET /api/appointments/:id', () => {
    it('should return 404 for non-existent appointment', async () => {
      const response = await request(app)
        .get('/api/appointments/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/appointments/:id', () => {
    it('should return 404 for non-existent appointment', async () => {
      const response = await request(app)
        .delete('/api/appointments/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Health Check', () => {
  it('should return OK status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});
