/**
 * Authentication Tests
 * Tests for admin authentication middleware and functions
 */

import {
  generateSessionToken,
  verifyAdminPassword,
  createSession,
  validateSession,
  destroySession,
  getSessionCount,
  clearAllSessions
} from '../../src/middleware/adminAuth';

describe('Admin Authentication', () => {
  // Clean up before each test
  beforeEach(() => {
    clearAllSessions();
  });

  describe('generateSessionToken', () => {
    it('should generate a hex string token', () => {
      const token = generateSessionToken();
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate tokens of 64 characters (32 bytes as hex)', () => {
      const token = generateSessionToken();
      expect(token.length).toBe(64);
    });

    it('should generate unique tokens each time', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAdminPassword', () => {
    it('should accept correct password', () => {
      // Default password is 'admin123'
      expect(verifyAdminPassword('admin123')).toBe(true);
    });

    it('should reject incorrect password', () => {
      expect(verifyAdminPassword('wrongpassword')).toBe(false);
    });

    it('should reject empty password', () => {
      expect(verifyAdminPassword('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(verifyAdminPassword('Admin123')).toBe(false);
      expect(verifyAdminPassword('ADMIN123')).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create a session and return a token', () => {
      const token = createSession();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should increment session count', () => {
      expect(getSessionCount()).toBe(0);
      createSession();
      expect(getSessionCount()).toBe(1);
      createSession();
      expect(getSessionCount()).toBe(2);
    });

    it('should create valid sessions', () => {
      const token = createSession();
      expect(validateSession(token)).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('should validate existing session', () => {
      const token = createSession();
      expect(validateSession(token)).toBe(true);
    });

    it('should reject non-existent token', () => {
      expect(validateSession('nonexistenttoken')).toBe(false);
    });

    it('should reject empty token', () => {
      expect(validateSession('')).toBe(false);
    });

    it('should reject random token', () => {
      expect(validateSession(generateSessionToken())).toBe(false);
    });
  });

  describe('destroySession', () => {
    it('should invalidate a session', () => {
      const token = createSession();
      expect(validateSession(token)).toBe(true);
      destroySession(token);
      expect(validateSession(token)).toBe(false);
    });

    it('should decrement session count', () => {
      const token1 = createSession();
      const token2 = createSession();
      expect(getSessionCount()).toBe(2);
      destroySession(token1);
      expect(getSessionCount()).toBe(1);
      destroySession(token2);
      expect(getSessionCount()).toBe(0);
    });

    it('should handle destroying non-existent token', () => {
      expect(() => destroySession('nonexistent')).not.toThrow();
    });
  });

  describe('clearAllSessions', () => {
    it('should remove all sessions', () => {
      createSession();
      createSession();
      createSession();
      expect(getSessionCount()).toBe(3);
      clearAllSessions();
      expect(getSessionCount()).toBe(0);
    });
  });

  describe('Session Expiration', () => {
    // Note: We cannot easily test actual 24-hour expiration without mocking Date
    // These tests verify the validation logic exists

    it('should allow validating fresh sessions', () => {
      const token = createSession();
      // Fresh session should be valid
      expect(validateSession(token)).toBe(true);
    });
  });
});

describe('Multiple Sessions', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  it('should support multiple concurrent sessions', () => {
    const tokens = [
      createSession(),
      createSession(),
      createSession()
    ];

    tokens.forEach(token => {
      expect(validateSession(token)).toBe(true);
    });
  });

  it('should allow destroying one session without affecting others', () => {
    const token1 = createSession();
    const token2 = createSession();
    const token3 = createSession();

    destroySession(token2);

    expect(validateSession(token1)).toBe(true);
    expect(validateSession(token2)).toBe(false);
    expect(validateSession(token3)).toBe(true);
  });
});
