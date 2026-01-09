/**
 * Timezone Utilities
 * Handles timezone conversions for international users
 * 
 * The business operates in Pakistan Standard Time (UTC+5)
 * Appointments are stored in the business timezone
 * Users see times CONVERTED to their local timezone automatically
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
 * Get short timezone abbreviation for user's timezone
 */
export function getUserTimezoneAbbr(): string {
    const date = new Date();
    // Get timezone abbreviation from formatted date
    const formatter = new Intl.DateTimeFormat('en', {
        timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart?.value || 'Local';
}

/**
 * Check if user is in the same timezone as the business
 */
export function isUserInBusinessTimezone(): boolean {
    const userTz = getUserTimezone();
    // Check both the timezone name and the offset
    if (userTz === BUSINESS_TIMEZONE) return true;

    // Also check by offset for zones with same offset but different names
    const userOffset = -getUserTimezoneOffset(); // Convert to east-positive
    return userOffset === BUSINESS_TIMEZONE_OFFSET;
}

/**
 * Get timezone difference description for user
 * e.g., "3 hours ahead" or "same timezone"
 */
export function getTimezoneDescription(): string {
    const userOffset = -getUserTimezoneOffset(); // Convert to "hours from UTC" (east positive)
    const businessOffset = BUSINESS_TIMEZONE_OFFSET;
    const diffMinutes = userOffset - businessOffset;

    if (diffMinutes === 0) {
        return 'same timezone';
    }

    const diffHours = Math.abs(diffMinutes / 60);
    const direction = diffMinutes > 0 ? 'ahead' : 'behind';
    const hoursLabel = diffHours === 1 ? 'hour' : 'hours';

    return `${diffHours} ${hoursLabel} ${direction}`;
}

/**
 * Convert a business timezone date/time to user's local time
 * Input: YYYY-MM-DD and HH:mm in business timezone (PKT)
 * Output: Date object in user's local timezone
 */
export function businessTimeToLocal(dateStr: string, timeStr: string): Date {
    // Parse time
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Create date in UTC, then adjust for business timezone
    // Business is UTC+5, so subtract 5 hours to get UTC
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(5, 7)) - 1; // 0-indexed
    const day = parseInt(dateStr.substring(8, 10));

    // Create as if it's in business timezone by first making UTC
    // then adding the business offset
    const utcTime = Date.UTC(year, month, day, hours - 5, minutes, 0, 0);

    // Return as local Date (JavaScript automatically converts to local TZ)
    return new Date(utcTime);
}

/**
 * Format a date string for display in user's local timezone
 * Input: YYYY-MM-DD format (business timezone date)
 * Output: Formatted date string in user's local timezone
 */
export function formatBusinessDate(dateStr: string, timeStr: string = '12:00'): string {
    const localDate = businessTimeToLocal(dateStr, timeStr);
    return localDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format a time string for display in user's LOCAL timezone
 * Input: date (YYYY-MM-DD) and time (HH:mm) in business timezone
 * Output: Formatted time string in USER'S local timezone with AM/PM
 */
export function formatTimeInLocalZone(dateStr: string, timeStr: string): string {
    const localDate = businessTimeToLocal(dateStr, timeStr);
    return localDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format a time with timezone abbreviation for clarity
 * Shows time in user's local timezone with their TZ abbrev
 */
export function formatTimeWithZone(dateStr: string, timeStr: string): string {
    const localTime = formatTimeInLocalZone(dateStr, timeStr);

    // For local users in same timezone, just show time
    if (isUserInBusinessTimezone()) {
        return localTime;
    }

    // For international users, add their timezone abbreviation
    return `${localTime} (${getUserTimezoneAbbr()})`;
}

/**
 * Check if an appointment (in business timezone) is in the past
 * Compares business time appointment with current time (works regardless of user TZ)
 */
export function isAppointmentInPast(dateStr: string, timeStr: string): boolean {
    const now = new Date();
    const appointmentLocal = businessTimeToLocal(dateStr, timeStr);

    // If parsing failed, treat as upcoming (safer)
    if (isNaN(appointmentLocal.getTime())) {
        console.warn('[Timezone] Invalid date/time:', dateStr, timeStr);
        return false;
    }

    return appointmentLocal < now;
}

/**
 * Get business timezone abbreviation for display
 */
export function getBusinessTimezoneAbbr(): string {
    return 'PKT';  // Pakistan Standard Time
}

/**
 * Format date/time with timezone indicator if user is in different timezone
 * DEPRECATED: Use formatTimeWithZone instead for auto-conversion
 */
export function formatWithTimezoneNote(_dateStr: string, timeStr: string): string {
    // Simple fallback - just format the time
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}
