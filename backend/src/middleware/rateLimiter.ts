import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_WINDOWS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_MESSAGES } from '../constants/rateLimits';

// Helper to skip rate limiting for localhost (development/testing)
const skipLocalhost = (req: { ip?: string }) => {
    // SECURITY: Only skip in non-production environments
    if (process.env.NODE_ENV === 'production') return false;
    // Explicitly skip in test environment/CI
    if (process.env.NODE_ENV === 'test') return true;

    return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
};

/**
 * General API rate limiter
 * Allows 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOWS.GENERAL_API,
    max: RATE_LIMIT_MAX_REQUESTS.GENERAL_API,
    message: RATE_LIMIT_MESSAGES.GENERAL,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: skipLocalhost,
});

/**
 * Strict rate limiter for chat/AI endpoints
 * Allows 30 requests per 15 minutes per IP
 * Protects the expensive Groq API calls
 */
export const chatLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOWS.CHAT,
    max: RATE_LIMIT_MAX_REQUESTS.CHAT,
    message: RATE_LIMIT_MESSAGES.CHAT,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipLocalhost,
});

/**
 * Login rate limiter
 * Allows 5 login attempts per 15 minutes per IP
 * Prevents brute force attacks
 */
export const loginLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOWS.LOGIN,
    max: RATE_LIMIT_MAX_REQUESTS.LOGIN,
    message: RATE_LIMIT_MESSAGES.LOGIN,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipLocalhost,
});

/**
 * Appointment booking rate limiter
 * Allows 10 bookings per hour per IP
 * Prevents spam bookings
 */
export const bookingLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOWS.BOOKING,
    max: RATE_LIMIT_MAX_REQUESTS.BOOKING,
    message: RATE_LIMIT_MESSAGES.BOOKING,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipLocalhost,
});
