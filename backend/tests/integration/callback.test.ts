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

describe('Callback API Integration', () => {
  let createdCallbackId: string;

  describe('POST /api/callbacks', () => {
    it('should create a valid callback request', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Test Customer',
          customerPhone: '+14155551234',
          customerEmail: 'test@example.com',
          preferredTime: 'afternoon',
          concerns: 'General inquiry about services'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('customerName', 'Test Customer');
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body).toHaveProperty('createdAt');

      createdCallbackId = response.body.id;
    });

    it('should create callback without optional fields', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Basic User',
          customerPhone: '+14155559999'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
    });

    it('should reject callback with missing name', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerPhone: '+14155551234'
        })
        .expect(400);

      expect(response.body.error).toContain('name');
    });

    it('should reject callback with short name', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'A',
          customerPhone: '+14155551234'
        })
        .expect(400);

      expect(response.body.error).toContain('2 characters');
    });

    it('should reject callback with missing phone', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Test User'
        })
        .expect(400);

      expect(response.body.error).toContain('phone');
    });

    it('should reject callback with short phone', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Test User',
          customerPhone: '12345'
        })
        .expect(400);

      expect(response.body.error).toContain('phone');
    });

    it('should reject callback with invalid email', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Test User',
          customerPhone: '+14155551234',
          customerEmail: 'invalid-email'
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should accept callback with valid international phone', async () => {
      const response = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'International User',
          customerPhone: '+923001234567'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /api/callbacks', () => {
    it('should return list of callbacks', async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get('/api/callbacks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter callbacks by status', async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get('/api/callbacks?status=pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((callback: { status: string }) => {
        expect(callback.status).toBe('pending');
      });
    });
  });

  describe('GET /api/callbacks/:id', () => {
    it('should return specific callback', async () => {
      // First create a callback
      const createResponse = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Specific User',
          customerPhone: '+14155557777'
        })
        .expect(201);

      const id = createResponse.body.id;
      const token = await getAuthToken();

      const response = await request(app)
        .get(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', id);
      expect(response.body).toHaveProperty('customerName', 'Specific User');
    });

    it('should return 404 for non-existent callback', async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get('/api/callbacks/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/callbacks/:id', () => {
    it('should update callback status', async () => {
      // First create a callback
      const createResponse = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Update Test User',
          customerPhone: '+14155556666'
        })
        .expect(201);

      const id = createResponse.body.id;
      const token = await getAuthToken();

      const response = await request(app)
        .put(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'contacted' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'contacted');
    });

    it('should update callback notes', async () => {
      // First create a callback
      const createResponse = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Notes Test User',
          customerPhone: '+14155555555'
        })
        .expect(201);

      const id = createResponse.body.id;
      const token = await getAuthToken();

      const response = await request(app)
        .put(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Called and scheduled appointment' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject invalid status', async () => {
      // First create a callback
      const createResponse = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Invalid Status User',
          customerPhone: '+14155554444'
        })
        .expect(201);

      const id = createResponse.body.id;
      const token = await getAuthToken();

      const response = await request(app)
        .put(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 404 for non-existent callback', async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .put('/api/callbacks/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'contacted' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept all valid statuses', async () => {
      const validStatuses = ['pending', 'contacted', 'completed', 'no_answer'];
      const token = await getAuthToken();

      for (const status of validStatuses) {
        const createResponse = await request(app)
          .post('/api/callbacks')
          .send({
            customerName: `Status Test ${status}`,
            customerPhone: '+14155553333'
          })
          .expect(201);

        const response = await request(app)
          .put(`/api/callbacks/${createResponse.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status })
          .expect(200);

        expect(response.body.status).toBe(status);
      }
    });
  });

  describe('DELETE /api/callbacks/:id', () => {
    it('should delete existing callback', async () => {
      // First create a callback
      const createResponse = await request(app)
        .post('/api/callbacks')
        .send({
          customerName: 'Delete Test User',
          customerPhone: '+14155552222'
        })
        .expect(201);

      const id = createResponse.body.id;
      const token = await getAuthToken();

      const response = await request(app)
        .delete(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify it's deleted
      await request(app)
        .get(`/api/callbacks/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 for non-existent callback', async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .delete('/api/callbacks/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Callback Data Integrity', () => {
  it('should trim whitespace from inputs', async () => {
    // Public endpoint
    const response = await request(app)
      .post('/api/callbacks')
      .send({
        customerName: '  Trimmed User  ',
        customerPhone: '  +14155551111  '
      })
      .expect(201);

    // Verify by fetching the callback (protected)
    const token = await getAuthToken();
    const getResponse = await request(app)
      .get(`/api/callbacks/${response.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getResponse.body.customerName).toBe('Trimmed User');
    expect(getResponse.body.customerPhone).toBe('+14155551111');
  });

  it('should include createdAt timestamp', async () => {
    const response = await request(app)
      .post('/api/callbacks')
      .send({
        customerName: 'Timestamp User',
        customerPhone: '+14155550000'
      })
      .expect(201);

    expect(response.body).toHaveProperty('createdAt');
    const createdAt = new Date(response.body.createdAt);
    expect(createdAt).toBeInstanceOf(Date);
  });
});
