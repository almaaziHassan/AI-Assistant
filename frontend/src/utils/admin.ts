export const formatDate = (dateStr: string | Date | unknown): string => {
    if (!dateStr) return 'Invalid Date';

    let dateToFormat: Date;

    // Handle Date objects directly
    if (dateStr instanceof Date) {
        dateToFormat = dateStr;
    }
    // Handle string dates
    else if (typeof dateStr === 'string') {
        // PostgreSQL sometimes returns dates like "2026-01-05" without time
        // or with full ISO format "2026-01-05T00:00:00.000Z"
        const cleaned = dateStr.split('T')[0]; // Get just the date part
        dateToFormat = new Date(cleaned + 'T12:00:00'); // Use noon to avoid timezone issues
    }
    // Handle objects with toISOString (Date-like objects from JSON)
    else if (typeof dateStr === 'object' && dateStr !== null) {
        const obj = dateStr as Record<string, unknown>;
        if ('toISOString' in obj && typeof obj.toISOString === 'function') {
            dateToFormat = new Date(String(obj.toISOString()));
        } else {
            // Try to convert to string
            dateToFormat = new Date(String(dateStr));
        }
    }
    else {
        return 'Invalid Date';
    }

    if (isNaN(dateToFormat.getTime())) {
        console.warn('formatDate: Invalid date input:', dateStr);
        return 'Invalid Date';
    }

    return dateToFormat.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

export const formatTime = (time: string): string => {
    if (!time) return '';
    const timePart = time.split(':');
    const hours = parseInt(timePart[0], 10);
    const minutes = parseInt(timePart[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return time;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const getPreferredTimeLabel = (time: string | undefined): string => {
    const labels: Record<string, string> = {
        'morning': 'Morning (9am-12pm)',
        'afternoon': 'Afternoon (12pm-5pm)',
        'evening': 'Evening (5pm-8pm)',
        'anytime': 'Anytime'
    };
    return time ? labels[time] || time : 'Not specified';
};
