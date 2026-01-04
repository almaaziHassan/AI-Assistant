/**
 * Business Rules Constants
 * All business logic constants in one place
 */

import { TIME_CONSTANTS } from './time';

/**
 * Cancellation and booking policies
 */
export const BOOKING_POLICIES = {
    CANCELLATION_NOTICE_HOURS: 24,
    MINIMUM_ADVANCE_BOOKING_HOURS: 1
} as const;

/**
 * Statistics calculation periods
 */
export const STATS_PERIODS = {
    LAST_WEEK_DAYS: 7,
    LAST_MONTH_DAYS: 30,
    DEFAULT_SESSION_CLEANUP_DAYS: 30
} as const;

/**
 * Timezone configurations
 */
export const TIMEZONE = {
    PKT_UTC_OFFSET_HOURS: 5,
    PKT_UTC_OFFSET_MINUTES: 5 * TIME_CONSTANTS.MINUTES_PER_HOUR
} as const;

/**
 * Placeholder values (TODO: Replace with actual data)
 */
export const PLACEHOLDER_VALUES = {
    AVERAGE_APPOINTMENT_REVENUE: 100 // TODO: Calculate from actual service prices
} as const;

/**
 * Email-related business rules
 */
export const EMAIL_POLICIES = {
    CANCELLATION_NOTICE_HOURS: BOOKING_POLICIES.CANCELLATION_NOTICE_HOURS,
    CONFIRMATION_TIMEOUT_MS: 10000,
    GREETING_TIMEOUT_MS: 10000
} as const;
