/**
 * JWT Utilities
 * Centralized JWT token generation and verification
 * 
 * Why: Avoids duplicating JWT logic across middleware, routes, and socket handlers
 */

import jwt from 'jsonwebtoken';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const JWT_EXPIRES_IN = '7d';

/**
 * User payload stored in JWT
 */
export interface JWTPayload {
    userId: string;
    email: string;
    name: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Alias for backwards compatibility
 */
export type UserPayload = JWTPayload;

/**
 * Generate a JWT token for a user
 * @param payload - User data to encode
 * @returns Signed JWT token string
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(
        {
            userId: payload.userId,
            email: payload.email,
            name: payload.name,
            role: payload.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify a JWT token and extract payload
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid/expired
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        // Token is invalid or expired
        return null;
    }
}

/**
 * Decode a JWT token without verification
 * Useful for debugging or reading expired tokens
 * @param token - JWT token to decode
 * @returns Decoded payload or null
 */
export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Check if a token is expired
 * @param token - JWT token to check
 * @returns true if expired, false if valid
 */
export function isTokenExpired(token: string): boolean {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
}

/**
 * Get remaining time until token expires
 * @param token - JWT token
 * @returns Milliseconds until expiry, or 0 if expired
 */
export function getTokenExpiryTime(token: string): number {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return 0;
    const remaining = payload.exp * 1000 - Date.now();
    return remaining > 0 ? remaining : 0;
}
