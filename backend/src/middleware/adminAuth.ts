import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Environment variables
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Enforce security in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('FATAL: ADMIN_PASSWORD environment variable is required in production.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
  if (ADMIN_PASSWORD === 'admin123') {
    throw new Error('FATAL: You must change the ADMIN_PASSWORD in production.');
  }
} else {
  // Dev warnings
  if (ADMIN_PASSWORD === 'admin123') {
    console.warn('⚠️  [Security] Using default admin password (admin123). Set ADMIN_PASSWORD in .env');
  }
}

// Generate a JWT session token
export function createSession(): string {
  // Token expires in 24 hours
  return jwt.sign({ role: 'admin', timestamp: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
}

// Verify admin password
export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

// Validate session token
export function validateSession(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}

// Destroy session (Logout)
export function destroySession(token: string): void {
  // With JWT, we can't truly invalidate without a blacklist/DB.
  // For this scale, client-side removal is standard. 
  // Optionally, we could implement a blacklist here if using Redis.
}

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

// Testing helpers - No-ops in JWT mode
export function getSessionCount(): number { return 0; }
export function clearAllSessions(): void { }
