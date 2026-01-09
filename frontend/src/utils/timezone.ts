/**
 * Timezone Utilities
 * Handles timezone conversions for international users
 * 
 * The business operates in Pakistan Standard Time (UTC+5)
 * Appointments are stored in the business timezone
 * Users see times in the business timezone with a note if they're in a different timezone
 */

// Business timezone configuration
export const BUSINESS_TIMEZONE = 'Asia/Karachi';  // PKT (UTC+5)
export const BUSINESS_TIMEZONE_OFFSET = 5 * 60;   // +5 hours in minutes

/**
 * Get the user's timezone offset in minutes from UTC
 * Positive values are west of UTC, negative are east (JavaScript convention)
 */
export function getUserTimezoneOffset(): number {
    return new Date().getTimezoneOffset();
}

/**
 * Get the user's IANA timezone string
 */
export function getUserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if user is in the same timezone as the business
 */
export function isUserInBusinessTimezone(): boolean {
    const userTz = getUserTimezone();
    return userTz === BUSINESS_TIMEZONE;
}

/**
 * Get timezone difference description for user
 * e.g., "3 hours ahead of business" or "same timezone as business"
 */
export function getTimezoneDescription(): string {
    const userOffset = -getUserTimezoneOffset(); // Convert to "hours from UTC" (east positive)
    const businessOffset = BUSINESS_TIMEZONE_OFFSET;
    const diffMinutes = userOffset - businessOffset;

    if (diffMinutes === 0) {
        return 'Same timezone as business';
    }

    const diffHours = Math.abs(diffMinutes / 60);
    const direction = diffMinutes > 0 ? 'ahead of' : 'behind';
    const hoursLabel = diffHours === 1 ? 'hour' : 'hours';

    return `${diffHours} ${hoursLabel} ${direction} business timezone`;
}

/**
 * Format a date string for display in business timezone
 * Input: YYYY-MM-DD format (business timezone date)
 * Output: Formatted date string
 */
export function formatBusinessDate(dateStr: string): string {
    // Date is already in business timezone, format for display
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format a time string for display
 * Input: HH:mm format (business timezone time)
 * Output: Formatted time string with AM/PM
 */
export function formatBusinessTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Check if an appointment (in business timezone) is in the past
 * Compares business time appointment with current business time
 */
export function isAppointmentInPast(dateStr: string, timeStr: string): boolean {
    // Get current time in business timezone
    const now = new Date();

    // Convert current time to business timezone
    // Business is UTC+5, so we need to add 5 hours to UTC
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
    const businessNow = new Date(utcNow + (BUSINESS_TIMEZONE_OFFSET * 60000));

    // Parse appointment time (already in business timezone)
    const timeWithSeconds = timeStr.includes(':') && timeStr.split(':').length === 2
        ? `${timeStr}:00`
        : timeStr;
    const aptDateTime = new Date(`${dateStr}T${timeWithSeconds}`);

    // If parsing failed, treat as upcoming (safer)
    if (isNaN(aptDateTime.getTime())) {
        console.warn('[Timezone] Invalid date/time:', dateStr, timeStr);
        return false;
    }

    return aptDateTime < businessNow;
}

/**
 * Get business timezone abbreviation for display
 */
export function getBusinessTimezoneAbbr(): string {
    return 'PKT';  // Pakistan Standard Time
}

/**
 * Format date/time with timezone indicator if user is in different timezone
 */
export function formatWithTimezoneNote(_dateStr: string, timeStr: string): string {
    const formattedTime = formatBusinessTime(timeStr);

    if (!isUserInBusinessTimezone()) {
        return `${formattedTime} ${getBusinessTimezoneAbbr()}`;
    }

    return formattedTime;
}
