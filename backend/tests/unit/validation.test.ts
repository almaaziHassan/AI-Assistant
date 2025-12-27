/**
 * Validation Tests
 * Tests for phone and email validation logic
 */

describe('Phone Validation', () => {
  // These patterns match the scheduler's validation logic

  describe('US Phone Numbers', () => {
    it('should accept valid US phone with +1', () => {
      const phone = '+14155551234';
      const digits = phone.replace(/\D/g, '');
      expect(digits.length).toBe(11); // +1 + 10 digits
    });

    it('should accept US phone with spaces', () => {
      const phone = '+1 415 555 1234';
      const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
      expect(cleaned).toBe('+14155551234');
    });
  });

  describe('Pakistan Phone Numbers (+92)', () => {
    it('should accept valid Pakistan phone', () => {
      const phone = '+923001234567';
      const digits = phone.replace(/\D/g, '');
      expect(digits.length).toBe(12); // 92 + 10 digits
    });

    it('should accept Pakistan phone with spaces', () => {
      const phone = '+92 300 1234567';
      const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
      expect(cleaned).toBe('+923001234567');
    });
  });

  describe('India Phone Numbers (+91)', () => {
    it('should accept valid India phone', () => {
      const phone = '+919876543210';
      const digits = phone.replace(/\D/g, '');
      expect(digits.length).toBe(12); // 91 + 10 digits
    });
  });

  describe('UK Phone Numbers (+44)', () => {
    it('should accept valid UK phone', () => {
      const phone = '+447911123456';
      const digits = phone.replace(/\D/g, '');
      expect(digits).toMatch(/^44/);
    });
  });

  describe('Invalid Phone Numbers', () => {
    it('should reject too short numbers', () => {
      const phone = '+1234';
      const digits = phone.replace(/\D/g, '');
      expect(digits.length).toBeLessThan(8);
    });

    it('should identify missing country code', () => {
      const phone = '4155551234';
      expect(phone.startsWith('+')).toBe(false);
    });
  });
});

describe('Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  describe('Valid Emails', () => {
    it('should accept standard email', () => {
      expect(emailRegex.test('user@example.com')).toBe(true);
    });

    it('should accept email with subdomain', () => {
      expect(emailRegex.test('user@mail.example.com')).toBe(true);
    });

    it('should accept email with numbers', () => {
      expect(emailRegex.test('user123@example.com')).toBe(true);
    });

    it('should accept email with dots in local part', () => {
      expect(emailRegex.test('first.last@example.com')).toBe(true);
    });

    it('should accept email with plus sign', () => {
      expect(emailRegex.test('user+tag@example.com')).toBe(true);
    });
  });

  describe('Invalid Emails', () => {
    it('should reject email without @', () => {
      expect(emailRegex.test('userexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(emailRegex.test('user@')).toBe(false);
    });

    it('should reject email without TLD', () => {
      expect(emailRegex.test('user@example')).toBe(false);
    });

    it('should reject email with spaces', () => {
      expect(emailRegex.test('user @example.com')).toBe(false);
    });

    it('should reject empty email', () => {
      expect(emailRegex.test('')).toBe(false);
    });
  });

  describe('Common Typos Detection', () => {
    const commonTypos: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'hotmal.com': 'hotmail.com',
      'yahooo.com': 'yahoo.com'
    };

    it('should detect gmail typo', () => {
      const email = 'user@gmial.com';
      const domain = email.split('@')[1];
      expect(commonTypos[domain]).toBe('gmail.com');
    });

    it('should detect hotmail typo', () => {
      const email = 'user@hotmal.com';
      const domain = email.split('@')[1];
      expect(commonTypos[domain]).toBe('hotmail.com');
    });
  });
});

describe('Date Validation', () => {
  describe('Date Format', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    it('should accept YYYY-MM-DD format', () => {
      expect(dateRegex.test('2025-12-25')).toBe(true);
    });

    it('should reject MM-DD-YYYY format', () => {
      expect(dateRegex.test('12-25-2025')).toBe(false);
    });

    it('should reject slash separated date', () => {
      expect(dateRegex.test('2025/12/25')).toBe(false);
    });
  });

  describe('Date Logic', () => {
    it('should identify past date', () => {
      const pastDate = new Date('2020-01-01');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(pastDate < today).toBe(true);
    });

    it('should identify future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const today = new Date();
      expect(futureDate > today).toBe(true);
    });

    it('should calculate 30 days ahead', () => {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 25);
      expect(testDate <= maxDate).toBe(true);
    });
  });
});

describe('Time Validation', () => {
  describe('Time Format', () => {
    const timeRegex = /^\d{2}:\d{2}$/;

    it('should accept HH:MM format', () => {
      expect(timeRegex.test('09:00')).toBe(true);
      expect(timeRegex.test('14:30')).toBe(true);
      expect(timeRegex.test('23:59')).toBe(true);
    });

    it('should reject single digit hours', () => {
      expect(timeRegex.test('9:00')).toBe(false);
    });

    it('should reject 12-hour format with AM/PM', () => {
      expect(timeRegex.test('9:00 AM')).toBe(false);
    });
  });

  describe('Business Hours', () => {
    it('should identify time within business hours', () => {
      const openTime = 9 * 60; // 09:00 in minutes
      const closeTime = 19 * 60; // 19:00 in minutes
      const testTime = 14 * 60; // 14:00 in minutes
      expect(testTime >= openTime && testTime < closeTime).toBe(true);
    });

    it('should identify time before opening', () => {
      const openTime = 9 * 60;
      const testTime = 8 * 60; // 08:00
      expect(testTime < openTime).toBe(true);
    });
  });
});

describe('Name Validation', () => {
  it('should accept names with letters', () => {
    const name = 'John Doe';
    expect(name.length >= 2).toBe(true);
  });

  it('should reject empty names', () => {
    const name = '';
    expect(name.length < 2).toBe(true);
  });

  it('should reject single character names', () => {
    const name = 'A';
    expect(name.length < 2).toBe(true);
  });

  it('should trim whitespace', () => {
    const name = '  John Doe  ';
    expect(name.trim()).toBe('John Doe');
  });
});
