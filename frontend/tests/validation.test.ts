import { describe, it, expect } from 'vitest';
import { validatePhoneNumber, validateEmail, getSupportedCountries } from '../src/utils/validation';

describe('Phone Number Validation', () => {
  describe('Valid Phone Numbers', () => {
    it('should accept valid Pakistan phone number', () => {
      const result = validatePhoneNumber('+923001234567');
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('Pakistan');
    });

    it('should accept valid US phone number', () => {
      const result = validatePhoneNumber('+14155551234');
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('USA/Canada');
    });

    it('should accept valid UK phone number', () => {
      const result = validatePhoneNumber('+447911123456');
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('United Kingdom');
    });

    it('should accept valid India phone number', () => {
      const result = validatePhoneNumber('+919876543210');
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('India');
    });

    it('should accept phone number with spaces', () => {
      const result = validatePhoneNumber('+92 300 1234567');
      expect(result.isValid).toBe(true);
    });

    it('should accept phone number with dashes', () => {
      const result = validatePhoneNumber('+1-415-555-1234');
      expect(result.isValid).toBe(true);
    });

    it('should accept phone number with parentheses', () => {
      const result = validatePhoneNumber('+1 (415) 555-1234');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid Phone Numbers', () => {
    it('should reject phone without country code', () => {
      const result = validatePhoneNumber('3001234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('country code');
    });

    it('should reject phone starting with 0', () => {
      const result = validatePhoneNumber('03001234567');
      expect(result.isValid).toBe(false);
    });

    it('should reject phone with too few digits', () => {
      const result = validatePhoneNumber('+92300');
      expect(result.isValid).toBe(false);
    });

    it('should reject phone with too many digits for Pakistan', () => {
      const result = validatePhoneNumber('+9230012345678901');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('max');
    });

    it('should reject empty string', () => {
      const result = validatePhoneNumber('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Unknown Country Codes', () => {
    it('should accept valid length for unknown country', () => {
      const result = validatePhoneNumber('+9991234567890');
      expect(result.isValid).toBe(true);
    });
  });
});

describe('Email Validation', () => {
  describe('Valid Emails', () => {
    it('should accept standard email', () => {
      const result = validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should accept email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should accept email with numbers', () => {
      const result = validateEmail('user123@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should accept email with dots in local part', () => {
      const result = validateEmail('first.last@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should accept email with plus sign', () => {
      const result = validateEmail('user+tag@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should handle mixed case', () => {
      const result = validateEmail('User@Example.COM');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid Emails', () => {
    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject email without @', () => {
      const result = validateEmail('userexample.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject email without domain', () => {
      const result = validateEmail('user@');
      expect(result.isValid).toBe(false);
    });

    it('should reject email without TLD', () => {
      const result = validateEmail('user@example');
      expect(result.isValid).toBe(false);
    });

    it('should reject email with spaces', () => {
      const result = validateEmail('user @example.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject email with short TLD', () => {
      const result = validateEmail('user@example.c');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Common Typos Detection', () => {
    it('should detect gmail typo (gmial)', () => {
      const result = validateEmail('user@gmial.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('gmail.com');
    });

    it('should detect gmail typo (gmal)', () => {
      const result = validateEmail('user@gmal.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('gmail.com');
    });

    it('should detect hotmail typo', () => {
      const result = validateEmail('user@hotmal.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('hotmail.com');
    });

    it('should detect yahoo typo', () => {
      const result = validateEmail('user@yahooo.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('yahoo.com');
    });

    it('should detect outlook typo', () => {
      const result = validateEmail('user@outlok.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('outlook.com');
    });
  });
});

describe('Supported Countries', () => {
  it('should return list of countries', () => {
    const countries = getSupportedCountries();
    expect(Array.isArray(countries)).toBe(true);
    expect(countries.length).toBeGreaterThan(0);
  });

  it('should include Pakistan', () => {
    const countries = getSupportedCountries();
    const pakistan = countries.find(c => c.code === '+92');
    expect(pakistan).toBeDefined();
    expect(pakistan?.name).toBe('Pakistan');
  });

  it('should include USA', () => {
    const countries = getSupportedCountries();
    const usa = countries.find(c => c.code === '+1');
    expect(usa).toBeDefined();
    expect(usa?.name).toBe('USA/Canada');
  });

  it('should have example format for each country', () => {
    const countries = getSupportedCountries();
    countries.forEach(country => {
      expect(country.example).toBeDefined();
      expect(country.example.startsWith(country.code)).toBe(true);
    });
  });
});
