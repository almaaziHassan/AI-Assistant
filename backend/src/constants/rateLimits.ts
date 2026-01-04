/**
 * Rate Limiting Constants
 * Centralized rate limit configurations for all endpoints
 */

import { TIME_CONSTANTS } from './time';

/**
 * Time windows for different rate limiters
 */
export const RATE_LIMIT_WINDOWS = {
    GENERAL_API: 15 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE,
    CHAT: 15 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE,
    LOGIN: 15 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE,
    BOOKING: TIME_CONSTANTS.MILLISECONDS_PER_HOUR
} as const;

/**
 * Maximum requests allowed per window
 */
export const RATE_LIMIT_MAX_REQUESTS = {
    GENERAL_API: 100,
    CHAT: 30,
    LOGIN: 5,
    BOOKING: 10
} as const;

/**
 * User-friendly error messages for rate limiting
 */
export const RATE_LIMIT_MESSAGES = {
    GENERAL: 'Too many requests from this IP, please try again later.',
    CHAT: 'You are sending messages too quickly. Please wait a moment before trying again.',
    LOGIN: 'Too many login attempts, please try again later.',
    BOOKING: 'You have made too many booking requests. Please try again later.'
} as const;
