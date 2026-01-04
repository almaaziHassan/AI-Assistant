import { describe, it, expect } from '@jest/globals';
import {
    sanitizeString,
    validateEmail,
    validatePhone,
    validateDate,
    validateTime,
    isValidDateFormat,
    isValidEmail
} from '../../src/utils/validators';

describe('Validators', () => {
    describe('sanitizeString', () => {
        it('should trim whitespace', () => {
            expect(sanitizeString('  hello  ')).toBe('hello');
            expect(sanitizeString('\n\ttest\n\t')).toBe('test');
        });

        it('should remove < and > characters', () => {
            expect(sanitizeString('hello<script>alert("xss")</script>world'))
                .toBe('helloscriptalert("xss")/scriptworld');
            expect(sanitizeString('<div>test</div>')).toBe('divtest/div');
        });

        it('should limit length to 500 characters', () => {
            const longString = 'a'.repeat(1000);
            const result = sanitizeString(longString);
            expect(result.length).toBe(500);
        });

        it('should handle empty string', () => {
            expect(sanitizeString('')).toBe('');
        });

        it('should handle string with only whitespace', () => {
            expect(sanitizeString('   ')).toBe('');
        });

        it('should preserve valid characters', () => {
            expect(sanitizeString('Hello World 123 !@#$%')).toBe('Hello World 123 !@#$%');
        });

        it('should handle SQL injection attempts', () => {
            const malicious = "'; DROP TABLE users; --";
            const result = sanitizeString(malicious);
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
        });

        it('should handle XSS attempts', () => {
            expect(sanitizeString('<img src=x onerror=alert(1)>'))
                .toBe('img src=x onerror=alert(1)');
        });
    });

    describe('validateEmail', () => {
        describe('Valid Emails', () => {
            it('should accept standard email', () => {
                const result = validateEmail('user@example.com');
                expect(result.valid).toBe(true);
                expect(result.sanitized).toBe('user@example.com');
            });

            it('should accept email with subdomain', () => {
                const result = validateEmail('user@mail.example.com');
                expect(result.valid).toBe(true);
            });

            it('should accept email with numbers', () => {
                const result = validateEmail('user123@example.com');
                expect(result.valid).toBe(true);
            });

            it('should accept email with dots', () => {
                const result = validateEmail('first.last@example.com');
                expect(result.valid).toBe(true);
            });

            it('should accept email with plus sign', () => {
                const result = validateEmail('user+tag@example.com');
                expect(result.valid).toBe(true);
            });

            it('should accept email with hyphen in domain', () => {
                const result = validateEmail('user@my-domain.com');
                expect(result.valid).toBe(true);
            });

            it('should lowercase email', () => {
                const result = validateEmail('USER@EXAMPLE.COM');
                expect(result.valid).toBe(true);
                expect(result.sanitized).toBe('user@example.com');
            });

            it('should trim whitespace', () => {
                const result = validateEmail('  user@example.com  ');
                expect(result.valid).toBe(true);
                expect(result.sanitized).toBe('user@example.com');
            });
        });

        describe('Invalid Emails', () => {
            it('should reject email without @', () => {
                const result = validateEmail('userexample.com');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid email format');
            });

            it('should reject email without domain', () => {
                const result = validateEmail('user@');
                expect(result.valid).toBe(false);
            });

            it('should reject email without TLD', () => {
                const result = validateEmail('user@example');
                expect(result.valid).toBe(false);
            });

            it('should reject email with spaces', () => {
                const result = validateEmail('user @example.com');
                expect(result.valid).toBe(false);
            });

            it('should reject email without local part', () => {
                const result = validateEmail('@example.com');
                expect(result.valid).toBe(false);
            });

            it('should reject email with multiple @', () => {
                const result = validateEmail('user@@example.com');
                expect(result.valid).toBe(false);
            });

            it('should reject empty email', () => {
                const result = validateEmail('');
                expect(result.valid).toBe(false);
            });

            it('should reject email longer than 254 characters', () => {
                const longEmail = 'a'.repeat(250) + '@example.com';
                const result = validateEmail(longEmail);
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Email too long');
            });
        });

        describe('Edge Cases', () => {
            it('should handle email with underscore', () => {
                const result = validateEmail('user_name@example.com');
                expect(result.valid).toBe(true);
            });

            it('should handle multiple subdomains', () => {
                const result = validateEmail('user@mail.corp.example.com');
                expect(result.valid).toBe(true);
            });

            it('should handle short TLD', () => {
                const result = validateEmail('user@example.co');
                expect(result.valid).toBe(true);
            });
        });
    });

    describe('validatePhone', () => {
        describe('Valid Phone Numbers', () => {
            it('should accept standard US phone', () => {
                const result = validatePhone('+14155551234');
                expect(result.valid).toBe(true);
            });

            it('should accept phone with spaces', () => {
                const result = validatePhone('+1 415 555 1234');
                expect(result.valid).toBe(true);
            });

            it('should accept phone with dashes', () => {
                const result = validatePhone('+1-415-555-1234');
                expect(result.valid).toBe(true);
            });

            it('should accept phone with parentheses', () => {
                const result = validatePhone('+1 (415) 555-1234');
                expect(result.valid).toBe(true);
            });

            it('should accept international phone', () => {
                const result = validatePhone('+923001234567');
                expect(result.valid).toBe(true);
            });

            it('should sanitize phone number', () => {
                const result = validatePhone('+1 (415) 555-1234');
                expect(result.sanitized).not.toContain('(');
                expect(result.sanitized).not.toContain(')');
            });
        });

        describe('Invalid Phone Numbers', () => {
            it('should reject phone too short', () => {
                const result = validatePhone('+1234');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Phone number must be 10-20 characters');
            });

            it('should reject phone too long', () => {
                const result = validatePhone('+123456789012345678901');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Phone number must be 10-20 characters');
            });

            it('should reject empty phone', () => {
                const result = validatePhone('');
                expect(result.valid).toBe(false);
            });

            it('should remove invalid characters', () => {
                const result = validatePhone('+1-415-555-1234abc');
                expect(result.sanitized).not.toContain('a');
                expect(result.sanitized).not.toContain('b');
            });
        });
    });

    describe('validateDate', () => {
        describe('Valid Dates', () => {
            it('should accept YYYY-MM-DD format', () => {
                const result = validateDate('2026-01-04');
                expect(result.valid).toBe(true);
            });

            it('should accept leap year date', () => {
                const result = validateDate('2024-02-29');
                expect(result.valid).toBe(true);
            });

            it('should accept first day of year', () => {
                const result = validateDate('2026-01-01');
                expect(result.valid).toBe(true);
            });

            it('should accept last day of year', () => {
                const result = validateDate('2026-12-31');
                expect(result.valid).toBe(true);
            });
        });

        describe('Invalid Dates', () => {
            it('should reject MM-DD-YYYY format', () => {
                const result = validateDate('01-04-2026');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid date format. Use YYYY-MM-DD');
            });

            it('should reject slash separated date', () => {
                const result = validateDate('2026/01/04');
                expect(result.valid).toBe(false);
            });

            it('should reject invalid date', () => {
                const result = validateDate('2026-02-30');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid date');
            });

            it('should reject invalid month', () => {
                const result = validateDate('2026-13-01');
                expect(result.valid).toBe(false);
            });

            it('should reject empty date', () => {
                const result = validateDate('');
                expect(result.valid).toBe(false);
            });

            it('should reject partial date', () => {
                const result = validateDate('2026-01');
                expect(result.valid).toBe(false);
            });
        });
    });

    describe('validateTime', () => {
        describe('Valid Times', () => {
            it('should accept HH:MM format', () => {
                expect(validateTime('09:00').valid).toBe(true);
                expect(validateTime('14:30').valid).toBe(true);
                expect(validateTime('23:59').valid).toBe(true);
            });

            it('should accept midnight', () => {
                expect(validateTime('00:00').valid).toBe(true);
            });

            it('should accept noon', () => {
                expect(validateTime('12:00').valid).toBe(true);
            });
        });

        describe('Invalid Times', () => {
            it('should reject single digit hours', () => {
                const result = validateTime('9:00');
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid time format. Use HH:MM (24-hour)');
            });

            it('should reject 12-hour format', () => {
                const result = validateTime('9:00 AM');
                expect(result.valid).toBe(false);
            });

            it('should reject hour > 23', () => {
                expect(validateTime('24:00').valid).toBe(false);
                expect(validateTime('25:30').valid).toBe(false);
            });

            it('should reject minute > 59', () => {
                expect(validateTime('12:60').valid).toBe(false);
                expect(validateTime('08:99').valid).toBe(false);
            });

            it('should reject empty time', () => {
                expect(validateTime('').valid).toBe(false);
            });

            it('should reject partial time', () => {
                expect(validateTime('12').valid).toBe(false);
                expect(validateTime('12:').valid).toBe(false);
            });
        });
    });

    describe('isValidDateFormat', () => {
        it('should return true for valid YYYY-MM-DD', () => {
            expect(isValidDateFormat('2026-01-04')).toBe(true);
            expect(isValidDateFormat('2024-02-29')).toBe(true);
        });

        it('should return false for invalid format', () => {
            expect(isValidDateFormat('01-04-2026')).toBe(false);
            expect(isValidDateFormat('2026/01/04')).toBe(false);
        });

        it('should return false for invalid date', () => {
            expect(isValidDateFormat('2026-02-30')).toBe(false);
            expect(isValidDateFormat('2026-13-01')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isValidDateFormat('')).toBe(false);
        });
    });

    describe('isValidEmail', () => {
        it('should return true for valid emails', () => {
            expect(isValidEmail('user@example.com')).toBe(true);
            expect(isValidEmail('test.user@mail.example.com')).toBe(true);
        });

        it('should return false for invalid emails', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
        });

        it('should handle whitespace', () => {
            expect(isValidEmail('  user@example.com  ')).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        it('should validate a complete booking request', () => {
            const name = sanitizeString('  John Doe  ');
            const email = validateEmail('john.doe@example.com');
            const phone = validatePhone('+14155551234');
            const date = validateDate('2026-06-15');
            const time = validateTime('14:30');

            expect(name).toBe('John Doe');
            expect(email.valid).toBe(true);
            expect(phone.valid).toBe(true);
            expect(date.valid).toBe(true);
            expect(time.valid).toBe(true);
        });

        it('should catch all validation errors', () => {
            const email = validateEmail('invalid-email');
            const phone = validatePhone('123');
            const date = validateDate('2026/01/01');
            const time = validateTime('25:00');

            expect(email.valid).toBe(false);
            expect(phone.valid).toBe(false);
            expect(date.valid).toBe(false);
            expect(time.valid).toBe(false);
        });
    });

    describe('Security Tests', () => {
        it('should sanitize XSS attempts', () => {
            const xss1 = sanitizeString('<script>alert("xss")</script>');
            const xss2 = sanitizeString('<img src=x onerror=alert(1)>');

            expect(xss1).not.toContain('<script>');
            expect(xss2).not.toContain('<img');
        });

        it('should handle SQL injection patterns', () => {
            const sql = sanitizeString("'; DROP TABLE users; --");
            expect(sql).toBeTruthy();
            expect(sql.length).toBeLessThanOrEqual(500);
        });

        it('should prevent DoS via long strings', () => {
            const longInput = 'a'.repeat(10000);
            const result = sanitizeString(longInput);
            expect(result.length).toBe(500);
        });
    });
});
