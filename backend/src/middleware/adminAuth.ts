import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple session store (in production, use Redis or database)
const sessions = new Map<string, { createdAt: number }>();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Get admin password from environment - REQUIRED in production
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Warn if using default password in production
if (process.env.NODE_ENV === 'production' && ADMIN_PASSWORD === 'admin123') {
  console.error('⚠️  WARNING: Using default admin password in production!');
  console.error('⚠️  Set ADMIN_PASSWORD environment variable to a secure password.');
} else if (ADMIN_PASSWORD === 'admin123') {
  console.log('ℹ️  Using default admin password (development mode)');
}

// Generate a secure session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Verify admin password
export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

// Create a new session
export function createSession(): string {
  const token = generateSessionToken();
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

// Validate session token
export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;

  // Check if session has expired
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(token);
    return false;
  }

  return true;
}

// Destroy session (logout)
export function destroySession(token: string): void {
  sessions.delete(token);
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_DURATION) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Middleware to protect admin routes
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!validateSession(token)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  next();
}

// Get session count (for testing)
export function getSessionCount(): number {
  return sessions.size;
}

// Clear all sessions (for testing)
export function clearAllSessions(): void {
  sessions.clear();
}
