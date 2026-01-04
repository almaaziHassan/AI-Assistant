import { describe, it, expect } from 'vitest';
import { formatAppointmentDate, formatAppointmentTime, getPreferredTimeLabel } from '../src/utils/dateFormatters';

describe('Date Formatters', () => {
    describe('formatAppointmentDate', () => {
        it('should format YYYY-MM-DD to readable format', () => {
            const result = formatAppointmentDate('2026-01-04');
            // Date formatting depends on locale, so test components
            expect(result).toContain('January');
            expect(result).toContain('2026');
            expect(result).toContain('4');
        });

        it('should format another date correctly', () => {
            const result = formatAppointmentDate('2026-12-25');
            expect(result).toContain('December');
            expect(result).toContain('25');
            expect(result).toContain('2026');
        });

        it('should handle leap year dates', () => {
            const result = formatAppointmentDate('2024-02-29');
            expect(result).toContain('February');
            expect(result).toContain('29');
            expect(result).toContain('2024');
        });

        it('should return a string', () => {
            const result = formatAppointmentDate('2026-06-15');
            expect(typeof result).toBe('string');
        });

        it('should include day of week', () => {
            const result = formatAppointmentDate('2026-01-04');
            expect(result).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
        });
    });

    describe('formatAppointmentTime', () => {
        it('should convert 24-hour to 12-hour format', () => {
            expect(formatAppointmentTime('14:30')).toBe('2:30 PM');
            expect(formatAppointmentTime('09:00')).toBe('9:00 AM');
            expect(formatAppointmentTime('00:00')).toBe('12:00 AM');
            expect(formatAppointmentTime('12:00')).toBe('12:00 PM');
        });

        it('should handle morning times', () => {
            expect(formatAppointmentTime('08:00')).toBe('8:00 AM');
            expect(formatAppointmentTime('11:59')).toBe('11:59 AM');
        });

        it('should handle afternoon times', () => {
            expect(formatAppointmentTime('13:00')).toBe('1:00 PM');
            expect(formatAppointmentTime('17:30')).toBe('5:30 PM');
        });

        it('should handle midnight correctly', () => {
            expect(formatAppointmentTime('00:00')).toBe('12:00 AM');
            expect(formatAppointmentTime('00:30')).toBe('12:30 AM');
        });

        it('should handle noon correctly', () => {
            expect(formatAppointmentTime('12:00')).toBe('12:00 PM');
            expect(formatAppointmentTime('12:30')).toBe('12:30 PM');
        });

        it('should pad single-digit minutes', () => {
            expect(formatAppointmentTime('10:05')).toBe('10:05 AM');
            expect(formatAppointmentTime('15:00')).toBe('3:00 PM');
        });

        it('should return a string', () => {
            const result = formatAppointmentTime('10:30');
            expect(typeof result).toBe('string');
        });

        it('should include AM or PM', () => {
            const morning = formatAppointmentTime('09:00');
            const evening = formatAppointmentTime('21:00');

            expect(morning).toMatch(/AM|PM/);
            expect(evening).toMatch(/AM|PM/);
        });
    });

    describe('getPreferredTimeLabel', () => {
        it('should return correct label for morning', () => {
            expect(getPreferredTimeLabel('morning')).toBe('Morning (9am-12pm)');
        });

        it('should return correct label for afternoon', () => {
            expect(getPreferredTimeLabel('afternoon')).toBe('Afternoon (12pm-5pm)');
        });

        it('should return correct label for evening', () => {
            expect(getPreferredTimeLabel('evening')).toBe('Evening (5pm-8pm)');
        });

        it('should return correct label for anytime', () => {
            expect(getPreferredTimeLabel('anytime')).toBe('Anytime');
        });

        it('should return code itself for unknown values', () => {
            expect(getPreferredTimeLabel('unknown')).toBe('unknown');
            expect(getPreferredTimeLabel('')).toBe('');
            expect(getPreferredTimeLabel('MORNING')).toBe('MORNING'); // Case sensitive
        });

        it('should return a string', () => {
            const result = getPreferredTimeLabel('morning');
            expect(typeof result).toBe('string');
        });

        it('should include time range for specific times', () => {
            expect(getPreferredTimeLabel('morning')).toContain('9am-12pm');
            expect(getPreferredTimeLabel('afternoon')).toContain('12pm-5pm');
            expect(getPreferredTimeLabel('evening')).toContain('5pm-8pm');
        });

        it('should not include parentheses for anytime', () => {
            expect(getPreferredTimeLabel('anytime')).toBe('Anytime');
            expect(getPreferredTimeLabel('anytime')).not.toContain('(');
        });
    });

    describe('Consistency', () => {
        it('should produce consistent results for same input', () => {
            const date1 = formatAppointmentDate('2026-01-04');
            const date2 = formatAppointmentDate('2026-01-04');
            expect(date1).toBe(date2);

            const time1 = formatAppointmentTime('14:30');
            const time2 = formatAppointmentTime('14:30');
            expect(time1).toBe(time2);

            const label1 = getPreferredTimeLabel('morning');
            const label2 = getPreferredTimeLabel('morning');
            expect(label1).toBe(label2);
        });
    });
});
