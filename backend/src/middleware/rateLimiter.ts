import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Allows 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for chat/AI endpoints
 * Allows 30 requests per 15 minutes per IP
 * Protects the expensive Groq API calls
 */
export const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 chat requests per windowMs
    message: 'You are sending messages too quickly. Please wait a moment before trying again.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for localhost (development)
    skip: (req) => {
        return req.ip === '127.0.0.1' || req.ip === '::1';
    }
});

/**
 * Login rate limiter
 * Allows 5 login attempts per 15 minutes per IP
 * Prevents brute force attacks
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Appointment booking rate limiter
 * Allows 10 bookings per hour per IP
 * Prevents spam bookings
 */
export const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 bookings per hour
    message: 'You have made too many booking requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
