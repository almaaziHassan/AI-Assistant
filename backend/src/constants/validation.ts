/**
 * Validation Constants
 * Input validation limits and patterns
 */

/**
 * Field length limits
 */
export const VALIDATION_LIMITS = {
    PASSWORD: {
        MIN_LENGTH: 8,
        MAX_LENGTH: 100
    },
    NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 100
    },
    PHONE: {
        MIN_LENGTH: 10,
        MAX_LENGTH: 15
    },
    EMAIL: {
        MAX_LENGTH: 255
    },
    NOTES: {
        MAX_LENGTH: 500
    }
} as const;

/**
 * Common validation regex patterns
 */
export const VALIDATION_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    DATE: /^\d{4}-\d{2}-\d{2}$/,
    TIME_24H: /^([01]\d|2[0-3]):([0-5]\d)$/
} as const;

/**
 * Validation error messages
 */
export const VALIDATION_MESSAGES = {
    PASSWORD_TOO_LONG: (max: number) => `Password must be less than ${max} characters`,
    INVALID_EMAIL: 'Invalid email format',
    INVALID_DATE: 'Invalid date format. Use YYYY-MM-DD',
    INVALID_TIME: 'Invalid time format. Use HH:MM (24-hour)'
} as const;
