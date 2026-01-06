/**
 * Authentication Integration Tests
 * Tests for auth API endpoints and protected routes
 * 
 * NOTE: This app uses JWT-based authentication which is STATELESS.
 * - Logout is client-side (token removal) - server can't invalidate JWTs
 * - Tokens remain valid until they expire (24 hours)
 */

const API_URL = 'http://localhost:3000';

// Helper to login and get token
async function getAuthToken(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const data = await response.json() as { token?: string };
  return data.token || '';
}

describe('Auth API Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should return 400 if password is missing', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrongpassword' })
      });

      expect(response.status).toBe(401);
    });

    it('should return JWT token for correct password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { success?: boolean; token?: string };
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      // JWT tokens have 3 parts separated by dots
      expect(data.token?.split('.').length).toBe(3);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid token', async () => {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { success?: boolean };
      expect(data.success).toBe(true);
    });

    it('should return success even without token (JWT is stateless)', async () => {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should return valid: false without token', async () => {
      const response = await fetch(`${API_URL}/api/auth/verify`);

      expect(response.status).toBe(200);
      const data = await response.json() as { valid?: boolean };
      expect(data.valid).toBe(false);
    });

    it('should return valid: false with invalid token', async () => {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': 'Bearer invalidtoken123' }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { valid?: boolean };
      expect(data.valid).toBe(false);
    });

    it('should return valid: true with valid JWT token', async () => {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { valid?: boolean };
      expect(data.valid).toBe(true);
    });
  });
});

describe('Protected Admin Routes', () => {
  describe('Without Authentication', () => {
    it('should return 401 for /api/admin/dashboard', async () => {
      const response = await fetch(`${API_URL}/api/admin/dashboard`);
      expect(response.status).toBe(401);
    });

    it('should return 401 for /api/admin/staff', async () => {
      const response = await fetch(`${API_URL}/api/admin/staff`);
      expect(response.status).toBe(401);
    });

    it('should return 401 for /api/callbacks', async () => {
      const response = await fetch(`${API_URL}/api/callbacks`);
      expect(response.status).toBe(401);
    });
  });

  describe('With Invalid Token', () => {
    it('should return 401 for invalid token', async () => {
      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': 'Bearer invalidtoken' }
      });
      expect(response.status).toBe(401);
    });
  });

  describe('With Valid Authentication', () => {
    it('should access /api/admin/dashboard with valid token', async () => {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json() as { todayAppointments?: number };
      expect(data).toHaveProperty('todayAppointments');
    });

    it('should access /api/admin/staff with valid token', async () => {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/admin/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should access /api/callbacks with valid token', async () => {
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/callbacks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Unprotected Routes', () => {
  it('should access /api/health without auth', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    expect(response.status).toBe(200);
  });

  it('should access /api/services without auth', async () => {
    const response = await fetch(`${API_URL}/api/services`);
    expect(response.status).toBe(200);
  });

  it('should access /api/appointments/slots without auth', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const response = await fetch(`${API_URL}/api/appointments/slots?date=${dateStr}&serviceId=consultation`);
    expect(response.status).toBe(200);
  });
});
