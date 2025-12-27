/**
 * Authentication Integration Tests
 * Tests for auth API endpoints and protected routes
 */

import { clearAllSessions } from '../../src/middleware/adminAuth';

// Mock fetch for testing API endpoints
const API_URL = 'http://localhost:3000';

// Type helper for API responses
interface AuthResponse {
  success?: boolean;
  token?: string;
  error?: string;
  valid?: boolean;
  message?: string;
}

interface DashboardResponse {
  todayAppointments?: number;
  error?: string;
}

interface HealthResponse {
  status?: string;
}

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if password is missing', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json() as AuthResponse;
      expect(data.error).toBe('Password is required');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrongpassword' })
      });

      expect(response.status).toBe(401);
      const data = await response.json() as AuthResponse;
      expect(data.error).toBe('Invalid password');
    });

    it('should return token for correct password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(typeof data.token).toBe('string');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout with valid token', async () => {
      // First login
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });
      const loginData = await loginRes.json() as AuthResponse;
      const token = loginData.token;

      // Then logout
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.success).toBe(true);
    });

    it('should return success even without token', async () => {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should return valid: false without token', async () => {
      const response = await fetch(`${API_URL}/api/auth/verify`);

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.valid).toBe(false);
    });

    it('should return valid: false with invalid token', async () => {
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': 'Bearer invalidtoken123' }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.valid).toBe(false);
    });

    it('should return valid: true with valid token', async () => {
      // First login
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });
      const loginData = await loginRes.json() as AuthResponse;
      const token = loginData.token;

      // Then verify
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.valid).toBe(true);
    });

    it('should return valid: false after logout', async () => {
      // Login
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });
      const loginData = await loginRes.json() as AuthResponse;
      const token = loginData.token;

      // Logout
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Verify should now fail
      const response = await fetch(`${API_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as AuthResponse;
      expect(data.valid).toBe(false);
    });
  });
});

describe('Protected Admin Routes', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('Without Authentication', () => {
    it('should return 401 for /api/admin/dashboard', async () => {
      const response = await fetch(`${API_URL}/api/admin/dashboard`);
      expect(response.status).toBe(401);
      const data = await response.json() as AuthResponse;
      expect(data.error).toBe('Authentication required');
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
      const data = await response.json() as AuthResponse;
      expect(data.error).toBe('Invalid or expired session');
    });
  });

  describe('With Valid Authentication', () => {
    let authToken: string;

    beforeAll(async () => {
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'admin123' })
      });
      const data = await loginRes.json() as AuthResponse;
      authToken = data.token || '';
    });

    it('should access /api/admin/dashboard with valid token', async () => {
      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json() as DashboardResponse;
      expect(data).toHaveProperty('todayAppointments');
    });

    it('should access /api/admin/staff with valid token', async () => {
      const response = await fetch(`${API_URL}/api/admin/staff`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should access /api/callbacks with valid token', async () => {
      const response = await fetch(`${API_URL}/api/callbacks`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Unprotected Routes', () => {
  describe('Public Endpoints', () => {
    it('should access /api/health without auth', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      expect(response.status).toBe(200);
      const data = await response.json() as HealthResponse;
      expect(data.status).toBe('ok');
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
});
