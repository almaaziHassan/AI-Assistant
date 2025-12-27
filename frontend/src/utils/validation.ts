// Phone number validation rules by country (length-based only for flexibility)
export interface CountryPhoneRule {
  code: string;
  name: string;
  minLength: number;
  maxLength: number;
  example: string;
}

export const countryPhoneRules: Record<string, CountryPhoneRule> = {
  '1': { code: '+1', name: 'USA/Canada', minLength: 10, maxLength: 10, example: '+1 555 123 4567' },
  '7': { code: '+7', name: 'Russia', minLength: 10, maxLength: 10, example: '+7 912 345 6789' },
  '20': { code: '+20', name: 'Egypt', minLength: 10, maxLength: 10, example: '+20 10 1234 5678' },
  '27': { code: '+27', name: 'South Africa', minLength: 9, maxLength: 9, example: '+27 82 123 4567' },
  '31': { code: '+31', name: 'Netherlands', minLength: 9, maxLength: 9, example: '+31 6 1234 5678' },
  '33': { code: '+33', name: 'France', minLength: 9, maxLength: 9, example: '+33 6 12 34 56 78' },
  '34': { code: '+34', name: 'Spain', minLength: 9, maxLength: 9, example: '+34 612 345 678' },
  '39': { code: '+39', name: 'Italy', minLength: 9, maxLength: 11, example: '+39 312 345 6789' },
  '44': { code: '+44', name: 'United Kingdom', minLength: 10, maxLength: 11, example: '+44 7911 123456' },
  '49': { code: '+49', name: 'Germany', minLength: 10, maxLength: 12, example: '+49 151 12345678' },
  '52': { code: '+52', name: 'Mexico', minLength: 10, maxLength: 10, example: '+52 55 1234 5678' },
  '55': { code: '+55', name: 'Brazil', minLength: 10, maxLength: 11, example: '+55 11 91234 5678' },
  '60': { code: '+60', name: 'Malaysia', minLength: 9, maxLength: 10, example: '+60 12 345 6789' },
  '61': { code: '+61', name: 'Australia', minLength: 9, maxLength: 9, example: '+61 4 1234 5678' },
  '62': { code: '+62', name: 'Indonesia', minLength: 9, maxLength: 12, example: '+62 812 3456 7890' },
  '63': { code: '+63', name: 'Philippines', minLength: 10, maxLength: 10, example: '+63 917 123 4567' },
  '65': { code: '+65', name: 'Singapore', minLength: 8, maxLength: 8, example: '+65 9123 4567' },
  '66': { code: '+66', name: 'Thailand', minLength: 9, maxLength: 9, example: '+66 81 234 5678' },
  '81': { code: '+81', name: 'Japan', minLength: 10, maxLength: 11, example: '+81 90 1234 5678' },
  '82': { code: '+82', name: 'South Korea', minLength: 9, maxLength: 11, example: '+82 10 1234 5678' },
  '84': { code: '+84', name: 'Vietnam', minLength: 9, maxLength: 10, example: '+84 91 234 5678' },
  '86': { code: '+86', name: 'China', minLength: 11, maxLength: 11, example: '+86 131 2345 6789' },
  '90': { code: '+90', name: 'Turkey', minLength: 10, maxLength: 10, example: '+90 532 123 4567' },
  '91': { code: '+91', name: 'India', minLength: 10, maxLength: 10, example: '+91 98765 43210' },
  '92': { code: '+92', name: 'Pakistan', minLength: 10, maxLength: 10, example: '+92 300 1234567' },
  '94': { code: '+94', name: 'Sri Lanka', minLength: 9, maxLength: 9, example: '+94 71 234 5678' },
  '234': { code: '+234', name: 'Nigeria', minLength: 10, maxLength: 10, example: '+234 801 234 5678' },
  '254': { code: '+254', name: 'Kenya', minLength: 9, maxLength: 9, example: '+254 712 345 678' },
  '880': { code: '+880', name: 'Bangladesh', minLength: 10, maxLength: 10, example: '+880 1712 345678' },
  '966': { code: '+966', name: 'Saudi Arabia', minLength: 9, maxLength: 9, example: '+966 5 1234 5678' },
  '971': { code: '+971', name: 'UAE', minLength: 9, maxLength: 9, example: '+971 50 123 4567' },
  '977': { code: '+977', name: 'Nepal', minLength: 10, maxLength: 10, example: '+977 984 123 4567' }
};

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  country?: string;
  formattedNumber?: string;
}

export function validatePhoneNumber(phone: string): PhoneValidationResult {
  // Remove all spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Must start with +
  if (!cleaned.startsWith('+')) {
    return {
      isValid: false,
      error: 'Phone number must start with country code (e.g., +92 for Pakistan, +1 for USA)'
    };
  }

  // Remove the + for processing
  const withoutPlus = cleaned.substring(1);

  // Try to match country code (1-3 digits)
  let matchedCountry: CountryPhoneRule | null = null;
  let nationalNumber = '';

  // Check 3-digit codes first (e.g., 971, 966), then 2-digit (e.g., 92, 91, 44), then 1-digit (e.g., 1)
  for (const codeLength of [3, 2, 1]) {
    const potentialCode = withoutPlus.substring(0, codeLength);
    if (countryPhoneRules[potentialCode]) {
      matchedCountry = countryPhoneRules[potentialCode];
      nationalNumber = withoutPlus.substring(codeLength);
      break;
    }
  }

  if (!matchedCountry) {
    // Generic validation for unknown country codes
    if (withoutPlus.length < 8 || withoutPlus.length > 15) {
      return {
        isValid: false,
        error: 'Invalid phone number length. Please include country code (e.g., +92, +1)'
      };
    }
    // Accept if it looks like a valid international number
    if (/^[0-9]{8,15}$/.test(withoutPlus)) {
      return {
        isValid: true,
        formattedNumber: cleaned
      };
    }
    return {
      isValid: false,
      error: 'Invalid phone number format'
    };
  }

  // Validate national number length
  if (nationalNumber.length < matchedCountry.minLength) {
    return {
      isValid: false,
      error: `${matchedCountry.name} phone numbers need ${matchedCountry.minLength} digits after ${matchedCountry.code} (you provided ${nationalNumber.length}). Example: ${matchedCountry.example}`,
      country: matchedCountry.name
    };
  }

  if (nationalNumber.length > matchedCountry.maxLength) {
    return {
      isValid: false,
      error: `${matchedCountry.name} phone numbers have max ${matchedCountry.maxLength} digits after ${matchedCountry.code} (you provided ${nationalNumber.length}). Example: ${matchedCountry.example}`,
      country: matchedCountry.name
    };
  }

  // Length is valid - accept the number (no strict pattern validation)
  return {
    isValid: true,
    country: matchedCountry.name,
    formattedNumber: cleaned
  };
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: 'Email is required' };
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Check for common typos in popular domains
  const commonDomainTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmal.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com'
  };

  const domain = trimmed.split('@')[1];
  if (commonDomainTypos[domain]) {
    return {
      isValid: false,
      error: `Did you mean @${commonDomainTypos[domain]}?`
    };
  }

  // Check minimum length requirements
  const [localPart, domainPart] = trimmed.split('@');

  if (localPart.length < 1) {
    return { isValid: false, error: 'Email address is too short' };
  }

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email username is too long' };
  }

  // Check domain has at least 2 parts (name.tld)
  const domainParts = domainPart.split('.');
  if (domainParts.length < 2 || domainParts.some(part => part.length === 0)) {
    return { isValid: false, error: 'Please enter a valid email domain' };
  }

  // Check TLD length (minimum 2 characters)
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) {
    return { isValid: false, error: 'Please enter a valid email domain' };
  }

  // Check for invalid characters
  if (/[<>()[\]\\,;:\s]/.test(trimmed)) {
    return { isValid: false, error: 'Email contains invalid characters' };
  }

  return { isValid: true };
}

// Get list of supported countries for display
export function getSupportedCountries(): Array<{ code: string; name: string; example: string }> {
  return Object.entries(countryPhoneRules).map(([_, rule]) => ({
    code: rule.code,
    name: rule.name,
    example: rule.example
  }));
}

// Get list of countries with full details for PhoneInput component
export function getCountriesWithRules(): Array<CountryPhoneRule & { dialCode: string }> {
  return Object.entries(countryPhoneRules)
    .map(([dialCode, rule]) => ({
      ...rule,
      dialCode
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Get country rule by dial code (without +)
export function getCountryByDialCode(dialCode: string): CountryPhoneRule | undefined {
  return countryPhoneRules[dialCode];
}

// Validate phone with separate country code and number
export function validatePhoneWithCountry(countryCode: string, nationalNumber: string): PhoneValidationResult {
  const dialCode = countryCode.replace('+', '');
  const rule = countryPhoneRules[dialCode];

  if (!rule) {
    // Unknown country - use generic validation
    const digitsOnly = nationalNumber.replace(/\D/g, '');
    if (digitsOnly.length < 6 || digitsOnly.length > 15) {
      return {
        isValid: false,
        error: 'Please enter a valid phone number'
      };
    }
    return {
      isValid: true,
      formattedNumber: countryCode + digitsOnly
    };
  }

  const digitsOnly = nationalNumber.replace(/\D/g, '');

  if (digitsOnly.length < rule.minLength) {
    return {
      isValid: false,
      error: `${rule.name} numbers need ${rule.minLength} digits after ${rule.code}`,
      country: rule.name
    };
  }

  if (digitsOnly.length > rule.maxLength) {
    return {
      isValid: false,
      error: `${rule.name} numbers have max ${rule.maxLength} digits after ${rule.code}`,
      country: rule.name
    };
  }

  return {
    isValid: true,
    country: rule.name,
    formattedNumber: countryCode + digitsOnly
  };
}
