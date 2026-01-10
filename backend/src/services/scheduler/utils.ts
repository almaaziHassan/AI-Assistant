import { TIME_CONSTANTS } from '../../constants/time';

export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * TIME_CONSTANTS.MINUTES_PER_HOUR + minutes;
}

export function minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / TIME_CONSTANTS.MINUTES_PER_HOUR);
    const mins = minutes % TIME_CONSTANTS.MINUTES_PER_HOUR;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getDayOfWeek(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}
