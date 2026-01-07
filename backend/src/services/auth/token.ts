/**
 * Token Service
 * 
 * Single Responsibility: Handles token generation and validation
 * for email verification and password reset
 * 
 * Why separated: Token operations are used across multiple features
 * (registration, password reset, email change) and should be reusable
 */

import crypto from 'crypto';

// Why 32 bytes: 256 bits of entropy, sufficient for cryptographic security
// Provides 2^256 possible values, making brute force infeasible
const TOKEN_BYTES = 32;

// Expiry times in hours
// Why 24h for verification: Reasonable time for user to check email
// Why 1h for password reset: Shorter window limits exposure if email compromised
export const VERIFICATION_EXPIRES_HOURS = 24;
export const RESET_TOKEN_EXPIRES_HOURS = 1;

export interface TokenData {
    token: string;
    expires: Date;
}

export class TokenService {
    /**
     * Generate a cryptographically secure random token
     * 
     * Why crypto.randomBytes: Uses operating system's CSPRNG
     * (Cryptographically Secure Pseudo-Random Number Generator)
     * This is essential for security-sensitive tokens
     * 
     * Why hex encoding: Produces URL-safe string, no special characters
     * that might cause issues in email links
     */
    generateToken(): string {
        return crypto.randomBytes(TOKEN_BYTES).toString('hex');
    }

    /**
     * Generate verification token with expiry
     * 
     * Why separate method: Encapsulates verification-specific expiry logic
     * Making expiry a first-class citizen reduces bugs from forgotten expiry checks
     */
    generateVerificationToken(): TokenData {
        return {
            token: this.generateToken(),
            expires: new Date(Date.now() + VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000)
        };
    }

    /**
     * Generate password reset token with expiry
     * 
     * Why shorter expiry than verification: Password reset is more sensitive
     * If attacker has email access, shorter window limits damage
     */
    generateResetToken(): TokenData {
        return {
            token: this.generateToken(),
            expires: new Date(Date.now() + RESET_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000)
        };
    }

    /**
     * Check if a token has expired
     * 
     * Why explicit null check: Token might not have expiry (backwards compat)
     * In that case, we consider it expired for safety
     */
    isExpired(expiryDate: Date | null | undefined): boolean {
        if (!expiryDate) return true;
        return expiryDate < new Date();
    }
}

// Singleton export
export const tokenService = new TokenService();
