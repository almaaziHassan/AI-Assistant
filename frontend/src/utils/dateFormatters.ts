/**
 * Centralized date and time formatting utilities
 * Used across the application for consistent date/time display
 */

/**
 * Format a date string (YYYY-MM-DD) to a human-readable format
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Monday, January 4, 2026")
 */
export function formatAppointmentDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format a time string (HH:MM in 24-hour format) to 12-hour format
 * @param time - Time string in HH:MM format (24-hour)
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatAppointmentTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get preferred time label from code
 * @param code - Time preference code (morning, afternoon, evening, anytime)
 * @returns Human-readable time label
 */
export function getPreferredTimeLabel(code: string): string {
    const labels: Record<string, string> = {
        'morning': 'Morning (9am-12pm)',
        'afternoon': 'Afternoon (12pm-5pm)',
        'evening': 'Evening (5pm-8pm)',
        'anytime': 'Anytime'
    };
    return labels[code] || code;
}
