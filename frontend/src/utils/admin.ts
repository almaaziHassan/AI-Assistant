export const formatDate = (dateStr: string | Date): string => {
    let dateToFormat: Date;
    if (dateStr instanceof Date) {
        dateToFormat = dateStr;
    } else if (typeof dateStr === 'string') {
        dateToFormat = dateStr.includes('T')
            ? new Date(dateStr)
            : new Date(dateStr + 'T00:00:00');
    } else {
        return 'Invalid Date';
    }

    if (isNaN(dateToFormat.getTime())) {
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
