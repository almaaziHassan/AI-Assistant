/**
 * Password Service
 * 
 * Single Responsibility: Handles password hashing and comparison
 * Why separated: Password operations are security-critical and should be isolated
 * for easier auditing and potential future changes (e.g., switching hash algorithms)
 */

import bcrypt from 'bcryptjs';

// Why 12 rounds: Balance between security and performance
// 12 rounds ≈ 250ms on modern hardware, 10 rounds ≈ 60ms
// OWASP recommends 10+ rounds for bcrypt
const SALT_ROUNDS = 12;

// Minimum password length per NIST guidelines
const MIN_PASSWORD_LENGTH = 8;

export class PasswordService {
    /**
     * Hash a password using bcrypt
     * 
     * Why bcrypt: Industry standard for password hashing
     * - Adaptive cost factor (can increase rounds over time)
     * - Built-in salt (no need to manage separately)
     * - Resistant to rainbow table attacks
     */
    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Compare a password with a hash
     * 
     * Why constant-time comparison: bcrypt.compare uses timing-safe
     * comparison internally, preventing timing attacks where attackers
     * measure response times to guess password characters
     */
    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Validate password strength
     * 
     * Why 8 characters minimum: NIST SP 800-63B guidelines recommend
     * at least 8 characters. We don't enforce complexity rules (uppercase,
     * symbols, etc.) because NIST found users create predictable patterns
     * like "Password1!" which are easier to crack
     */
    validate(password: string): { valid: boolean; error?: string } {
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return {
                valid: false,
                error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            };
        }
        return { valid: true };
    }
}

// Singleton export for convenience
export const passwordService = new PasswordService();
