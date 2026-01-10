import { convertMinutesToMs } from '../../constants/time';
import servicesConfig from '../../config/services.json';

// Country-specific phone validation rules (length-based only for flexibility)
const countryPhoneRules: Record<string, { minLength: number; maxLength: number; name: string }> = {
    '1': { minLength: 10, maxLength: 10, name: 'USA/Canada' },
    '7': { minLength: 10, maxLength: 10, name: 'Russia' },
    '20': { minLength: 10, maxLength: 10, name: 'Egypt' },
    '27': { minLength: 9, maxLength: 9, name: 'South Africa' },
    '31': { minLength: 9, maxLength: 9, name: 'Netherlands' },
    '33': { minLength: 9, maxLength: 9, name: 'France' },
    '34': { minLength: 9, maxLength: 9, name: 'Spain' },
    '39': { minLength: 9, maxLength: 11, name: 'Italy' },
    '44': { minLength: 10, maxLength: 11, name: 'United Kingdom' },
    '49': { minLength: 10, maxLength: 12, name: 'Germany' },
    '52': { minLength: 10, maxLength: 10, name: 'Mexico' },
    '55': { minLength: 10, maxLength: 11, name: 'Brazil' },
    '60': { minLength: 9, maxLength: 10, name: 'Malaysia' },
    '61': { minLength: 9, maxLength: 9, name: 'Australia' },
    '62': { minLength: 9, maxLength: 12, name: 'Indonesia' },
    '63': { minLength: 10, maxLength: 10, name: 'Philippines' },
    '65': { minLength: 8, maxLength: 8, name: 'Singapore' },
    '66': { minLength: 9, maxLength: 9, name: 'Thailand' },
    '81': { minLength: 10, maxLength: 11, name: 'Japan' },
    '82': { minLength: 9, maxLength: 11, name: 'South Korea' },
    '84': { minLength: 9, maxLength: 10, name: 'Vietnam' },
    '86': { minLength: 11, maxLength: 11, name: 'China' },
    '90': { minLength: 10, maxLength: 10, name: 'Turkey' },
    '91': { minLength: 10, maxLength: 10, name: 'India' },
    '92': { minLength: 10, maxLength: 10, name: 'Pakistan' },
    '94': { minLength: 9, maxLength: 9, name: 'Sri Lanka' },
    '234': { minLength: 10, maxLength: 10, name: 'Nigeria' },
    '254': { minLength: 9, maxLength: 9, name: 'Kenya' },
    '880': { minLength: 10, maxLength: 10, name: 'Bangladesh' },
    '966': { minLength: 9, maxLength: 9, name: 'Saudi Arabia' },
    '971': { minLength: 9, maxLength: 9, name: 'UAE' },
    '977': { minLength: 10, maxLength: 10, name: 'Nepal' }
};

// Validate date format (YYYY-MM-DD)
export function isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
}

// Check if date is in the past
export function isDateInPast(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    return checkDate < today;
}

// Check if date is too far in advance
export function isDateTooFarAhead(date: string, maxDays = servicesConfig.appointmentSettings.maxAdvanceBookingDays): boolean {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxDays);
    const checkDate = new Date(date);
    return checkDate > maxDate;
}

// Check if time slot is in the past (for today's bookings)
export function isTimeSlotInPast(date: string, time: string, timezoneOffset?: number): boolean {
    const now = new Date();

    // If timezone offset provided, adjust "now" to client's timezone
    if (timezoneOffset !== undefined) {
        // Client sends their offset (e.g., -300 means UTC-5)
        // We need to calculate what time it is for the client
        const clientNow = new Date(now.getTime() - convertMinutesToMs(timezoneOffset));
        const slotDateTime = new Date(`${date}T${time}:00`);
        // Adjust slot to compare in same reference
        const slotInClientTime = new Date(slotDateTime.getTime());
        return slotInClientTime <= clientNow;
    }

    // Default behavior: use server time
    const slotDateTime = new Date(`${date}T${time}:00`);
    return slotDateTime <= now;
}

// Validate email format
export function isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Validate phone format with country code
export function isValidPhone(phone: string): { valid: boolean; error?: string } {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

    // Must start with +
    if (!cleaned.startsWith('+')) {
        return { valid: false, error: 'Phone number must start with country code (e.g., +91 for India, +1 for USA)' };
    }

    const withoutPlus = cleaned.substring(1);

    // Must contain only digits after the +
    if (!/^[0-9]+$/.test(withoutPlus)) {
        return { valid: false, error: 'Phone number can only contain digits after the country code' };
    }

    // Try to match country code (3-digit first, then 2-digit, then 1-digit)
    let matchedRule: { minLength: number; maxLength: number; name: string } | null = null;
    let nationalNumber = '';
    let countryCode = '';

    for (const codeLength of [3, 2, 1]) {
        const potentialCode = withoutPlus.substring(0, codeLength);
        if (countryPhoneRules[potentialCode]) {
            matchedRule = countryPhoneRules[potentialCode];
            nationalNumber = withoutPlus.substring(codeLength);
            countryCode = potentialCode;
            break;
        }
    }

    if (!matchedRule) {
        // Generic validation for unknown country codes
        // Accept any number between 8-15 digits total (including country code)
        if (withoutPlus.length < 8 || withoutPlus.length > 15) {
            return { valid: false, error: 'Phone number should be 8-15 digits including country code' };
        }
        return { valid: true };
    }

    // Validate national number length for known countries
    if (nationalNumber.length < matchedRule.minLength) {
        return {
            valid: false,
            error: `${matchedRule.name} numbers need ${matchedRule.minLength} digits after +${countryCode} (you provided ${nationalNumber.length})`
        };
    }

    if (nationalNumber.length > matchedRule.maxLength) {
        return {
            valid: false,
            error: `${matchedRule.name} numbers have max ${matchedRule.maxLength} digits after +${countryCode} (you provided ${nationalNumber.length})`
        };
    }

    return { valid: true };
}
