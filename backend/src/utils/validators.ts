/**
 * Centralized validation utilities
 * Shared between middleware and services to ensure consistency
 */

/**
 * Sanitize string inputs to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
        .substring(0, 500); // Limit length to prevent DoS via large inputs
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid email format' };
    }

    if (sanitized.length > 254) {
        return { valid: false, sanitized, error: 'Email too long' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate phone number (flexible international format)
 */
export function validatePhone(phone: string): { valid: boolean; sanitized: string; error?: string } {
    // Remove all non-digit characters except + at the start
    const sanitized = phone.replace(/[^\d+]/g, '').trim();

    if (sanitized.length < 10 || sanitized.length > 20) {
        return { valid: false, sanitized, error: 'Phone number must be 10-20 characters' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate date (YYYY-MM-DD)
 */
export function validateDate(date: string): { valid: boolean; error?: string } {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(date)) {
        return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
    }

    // Parse and validate the date properly (catches invalid dates like Feb 30)
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);

    if (isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day) {
        return { valid: false, error: 'Invalid date' };
    }

    return { valid: true };
}

/**
 * Validate time (HH:MM)
 */
export function validateTime(time: string): { valid: boolean; error?: string } {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(time)) {
        return { valid: false, error: 'Invalid time format. Use HH:MM (24-hour)' };
    }

    return { valid: true };
}

/**
 * Check if date format is valid (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);

    // Check that the parsed date matches the input (catches invalid dates like Feb 30)
    return !isNaN(parsedDate.getTime()) &&
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day;
}

/**
 * Check if email format is valid
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
}
