/**
 * Authentication Integration Tests
 * Tests for auth API endpoints and protected routes
 * 
 * NOTE: This app uses JWT-based authentication which is STATELESS.
 */

import request from 'supertest';
import { createTestApp } from '../testApp';

const app = createTestApp();

// Helper to login and get token
async function getAuthToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const response = await request(app)
    .post('/api/auth/login')
    .send({ password });
  return response.body.token || '';
}

describe('Auth API Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
    });

    it('should return JWT token for correct password', async () => {
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password });

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      // JWT tokens have 3 parts separated by dots
      expect(data.token?.split('.').length).toBe(3);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return success even without token (JWT is stateless)', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should return valid: false without token', async () => {
      const response = await request(app).get('/api/auth/verify');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return valid: false with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should return valid: true with valid JWT token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });
  });
});

describe('Protected Admin Routes', () => {
  describe('Without Authentication', () => {
    it('should return 401 for /api/admin/dashboard', async () => {
      const response = await request(app).get('/api/admin/dashboard');
      expect(response.status).toBe(401);
    });

    it('should return 401 for /api/admin/staff', async () => {
      const response = await request(app).get('/api/admin/staff');
      expect(response.status).toBe(401);
    });

    it('should return 401 for /api/callbacks', async () => {
      const response = await request(app).get('/api/callbacks');
      expect(response.status).toBe(401);
    });
  });

  describe('With Invalid Token', () => {
    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalidtoken');
      expect(response.status).toBe(401);
    });
  });

  describe('With Valid Authentication', () => {
    it('should access /api/admin/dashboard with valid token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('todayAppointments');
    });

    it('should access /api/admin/staff with valid token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should access /api/callbacks with valid token', async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get('/api/callbacks')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

describe('Unprotected Routes', () => {
  it('should access /api/health without auth', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });

  it('should access /api/services without auth', async () => {
    const response = await request(app).get('/api/services');
    expect(response.status).toBe(200);
  });

  it('should access /api/appointments/slots without auth', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/appointments/slots?date=${dateStr}&serviceId=consultation`);
    expect(response.status).toBe(200);
  });
});
