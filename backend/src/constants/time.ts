/**
 * Time Constants
 * All time-related constants and conversion utilities
 */

export const TIME_CONSTANTS = {
    // Base units
    MILLISECONDS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60,
    MINUTES_PER_HOUR: 60,
    HOURS_PER_DAY: 24,

    // Derived milliseconds
    MILLISECONDS_PER_MINUTE: 60 * 1000,
    MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
    MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,

    // Common periods
    DAYS_PER_WEEK: 7,
    DAYS_PER_MONTH: 30,
    WEEKS_PER_MONTH: 4,
    MONTHS_PER_YEAR: 12
} as const;

/**
 * Helper function to get a date N days ago
 */
export function getDaysAgo(days: number): Date {
    return new Date(Date.now() - days * TIME_CONSTANTS.MILLISECONDS_PER_DAY);
}

/**
 * Helper function to get a date N days ago as ISO string (YYYY-MM-DD)
 */
export function getDaysAgoISO(days: number): string {
    return getDaysAgo(days).toISOString().split('T')[0];
}

/**
 * Convert minutes to milliseconds
 */
export function convertMinutesToMs(minutes: number): number {
    return minutes * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE;
}

/**
 * Convert hours to milliseconds
 */
export function convertHoursToMs(hours: number): number {
    return hours * TIME_CONSTANTS.MILLISECONDS_PER_HOUR;
}
