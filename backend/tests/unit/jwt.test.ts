/**
 * JWT Utilities Unit Tests
 * Tests token generation, verification, and utility functions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
    generateToken,
    verifyToken,
    decodeToken,
    isTokenExpired,
    getTokenExpiryTime,
    JWTPayload
} from '../../src/utils/jwt';

describe('JWT Utilities', () => {
    const testPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'customer'
    };

    let validToken: string;

    beforeAll(() => {
        validToken = generateToken(testPayload);
    });

    describe('generateToken', () => {
        it('should generate a valid JWT token', () => {
            const token = generateToken(testPayload);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });

        it('should include all payload fields', () => {
            const token = generateToken(testPayload);
            const decoded = decodeToken(token);

            expect(decoded).not.toBeNull();
            expect(decoded?.userId).toBe(testPayload.userId);
            expect(decoded?.email).toBe(testPayload.email);
            expect(decoded?.name).toBe(testPayload.name);
            expect(decoded?.role).toBe(testPayload.role);
        });

        it('should set expiration time', () => {
            const token = generateToken(testPayload);
            const decoded = decodeToken(token);

            expect(decoded?.exp).toBeDefined();
            expect(decoded?.iat).toBeDefined();
            expect(decoded!.exp! > decoded!.iat!).toBe(true);
        });
    });

    describe('verifyToken', () => {
        it('should return payload for valid token', () => {
            const result = verifyToken(validToken);

            expect(result).not.toBeNull();
            expect(result?.userId).toBe(testPayload.userId);
            expect(result?.email).toBe(testPayload.email);
        });

        it('should return null for invalid token', () => {
            const result = verifyToken('invalid.token.here');

            expect(result).toBeNull();
        });

        it('should return null for malformed token', () => {
            const result = verifyToken('not-a-jwt');

            expect(result).toBeNull();
        });

        it('should return null for empty token', () => {
            const result = verifyToken('');

            expect(result).toBeNull();
        });

        it('should return null for token with wrong signature', () => {
            // Take a valid token and corrupt the signature
            const parts = validToken.split('.');
            parts[2] = 'corrupted_signature';
            const corruptedToken = parts.join('.');

            const result = verifyToken(corruptedToken);

            expect(result).toBeNull();
        });
    });

    describe('decodeToken', () => {
        it('should decode token without verification', () => {
            const result = decodeToken(validToken);

            expect(result).not.toBeNull();
            expect(result?.userId).toBe(testPayload.userId);
        });

        it('should return null for invalid format', () => {
            const result = decodeToken('not-a-jwt');

            expect(result).toBeNull();
        });

        it('should decode even with wrong signature', () => {
            // Unlike verify, decode should work even with corrupted signature
            const parts = validToken.split('.');
            parts[2] = 'corrupted_signature';
            const corruptedToken = parts.join('.');

            const result = decodeToken(corruptedToken);

            // Should still decode the payload
            expect(result?.userId).toBe(testPayload.userId);
        });
    });

    describe('isTokenExpired', () => {
        it('should return false for valid non-expired token', () => {
            const result = isTokenExpired(validToken);

            expect(result).toBe(false);
        });

        it('should return true for invalid token', () => {
            const result = isTokenExpired('invalid-token');

            expect(result).toBe(true);
        });

        it('should return true for empty token', () => {
            const result = isTokenExpired('');

            expect(result).toBe(true);
        });
    });

    describe('getTokenExpiryTime', () => {
        it('should return remaining time for valid token', () => {
            const remaining = getTokenExpiryTime(validToken);

            expect(remaining).toBeGreaterThan(0);
            // 7 days = 604800000 ms, should be close to that for fresh token
            expect(remaining).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
        });

        it('should return 0 for invalid token', () => {
            const remaining = getTokenExpiryTime('invalid-token');

            expect(remaining).toBe(0);
        });

        it('should return 0 for empty token', () => {
            const remaining = getTokenExpiryTime('');

            expect(remaining).toBe(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle special characters in payload', () => {
            const specialPayload = {
                userId: 'user-with-special-chars',
                email: 'test+special@example.com',
                name: 'Test "User" <script>',
                role: 'customer'
            };

            const token = generateToken(specialPayload);
            const decoded = verifyToken(token);

            expect(decoded?.name).toBe(specialPayload.name);
            expect(decoded?.email).toBe(specialPayload.email);
        });

        it('should handle unicode in payload', () => {
            const unicodePayload = {
                userId: 'user-unicode',
                email: 'test@example.com',
                name: '日本語ユーザー 🎉',
                role: 'customer'
            };

            const token = generateToken(unicodePayload);
            const decoded = verifyToken(token);

            expect(decoded?.name).toBe(unicodePayload.name);
        });

        it('should handle very long names', () => {
            const longPayload = {
                userId: 'user-long',
                email: 'test@example.com',
                name: 'A'.repeat(1000),
                role: 'customer'
            };

            const token = generateToken(longPayload);
            const decoded = verifyToken(token);

            expect(decoded?.name).toBe(longPayload.name);
        });
    });
});
