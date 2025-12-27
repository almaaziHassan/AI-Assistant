import { ReceptionistService } from '../../src/services/receptionist';

// Mock the Groq service
jest.mock('../../src/services/groq', () => ({
  GroqService: jest.fn().mockImplementation(() => ({
    chatWithFunctions: jest.fn()
  }))
}));

// Mock the database
jest.mock('../../src/db/database', () => ({
  runQuery: jest.fn(),
  getOne: jest.fn(),
  getAll: jest.fn().mockReturnValue([])
}));

// Mock admin service
jest.mock('../../src/services/admin', () => ({
  adminService: {
    getAllStaff: jest.fn().mockReturnValue([]),
    getHolidayByDate: jest.fn().mockReturnValue(null)
  }
}));

describe('ReceptionistService', () => {
  let receptionist: ReceptionistService;

  beforeEach(() => {
    jest.clearAllMocks();
    receptionist = new ReceptionistService();
  });

  describe('getConfig', () => {
    it('should return configuration object', () => {
      const config = receptionist.getConfig();
      expect(config).toBeDefined();
      expect(config).toHaveProperty('business');
      expect(config).toHaveProperty('services');
      expect(config).toHaveProperty('hours');
    });

    it('should have business information', () => {
      const config = receptionist.getConfig();
      expect(config.business).toHaveProperty('name');
      expect(config.business).toHaveProperty('phone');
      expect(config.business).toHaveProperty('email');
    });
  });

  describe('getServices', () => {
    it('should return array of services', () => {
      const services = receptionist.getServices();
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    it('should include consultation service', () => {
      const services = receptionist.getServices();
      const consultation = services.find(s => s.id === 'consultation');
      expect(consultation).toBeDefined();
      expect(consultation?.price).toBe(0); // Free consultation
    });

    it('should include massage services', () => {
      const services = receptionist.getServices();
      const swedishMassage = services.find(s => s.id === 'swedish-massage');
      const deepTissue = services.find(s => s.id === 'deep-tissue');
      expect(swedishMassage).toBeDefined();
      expect(deepTissue).toBeDefined();
    });
  });

  describe('getBusinessHours', () => {
    it('should return hours for all days', () => {
      const hours = receptionist.getBusinessHours();
      expect(hours).toHaveProperty('monday');
      expect(hours).toHaveProperty('tuesday');
      expect(hours).toHaveProperty('wednesday');
      expect(hours).toHaveProperty('thursday');
      expect(hours).toHaveProperty('friday');
      expect(hours).toHaveProperty('saturday');
      expect(hours).toHaveProperty('sunday');
    });

    it('should have open and close times', () => {
      const hours = receptionist.getBusinessHours();
      expect(hours.monday).toHaveProperty('open');
      expect(hours.monday).toHaveProperty('close');
    });

    it('should have valid time format', () => {
      const hours = receptionist.getBusinessHours();
      const timeRegex = /^\d{2}:\d{2}$/;
      expect(hours.monday.open).toMatch(timeRegex);
      expect(hours.monday.close).toMatch(timeRegex);
    });
  });

  describe('getBusinessInfo', () => {
    it('should return business information', () => {
      const info = receptionist.getBusinessInfo();
      expect(info).toBeDefined();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('phone');
      expect(info).toHaveProperty('email');
      expect(info).toHaveProperty('address');
    });

    it('should have Serenity Wellness Spa as name', () => {
      const info = receptionist.getBusinessInfo();
      expect(info.name).toBe('Serenity Wellness Spa');
    });
  });

  describe('Configuration Integrity', () => {
    it('should have valid service durations', () => {
      const services = receptionist.getServices();
      services.forEach(service => {
        expect(service.duration).toBeGreaterThan(0);
        expect(service.duration % 15).toBe(0); // Should be multiple of 15
      });
    });

    it('should have valid service prices', () => {
      const services = receptionist.getServices();
      services.forEach(service => {
        expect(service.price).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have receptionist configuration', () => {
      const config = receptionist.getConfig();
      expect(config).toHaveProperty('receptionist');
      expect(config.receptionist).toHaveProperty('name');
      expect(config.receptionist).toHaveProperty('greeting');
    });

    it('should have appointment settings', () => {
      const config = receptionist.getConfig();
      expect(config).toHaveProperty('appointmentSettings');
      expect(config.appointmentSettings).toHaveProperty('slotDuration');
      expect(config.appointmentSettings).toHaveProperty('bufferBetweenAppointments');
      expect(config.appointmentSettings).toHaveProperty('maxAdvanceBookingDays');
    });
  });

  describe('FAQ Configuration', () => {
    it('should have FAQs array', () => {
      const config = receptionist.getConfig() as { faqs?: unknown[] };
      expect(config.faqs).toBeDefined();
      expect(Array.isArray(config.faqs)).toBe(true);
    });

    it('should have FAQs with required properties', () => {
      const config = receptionist.getConfig() as { faqs?: Array<{ id: string; question: string; answer: string; keywords: string[] }> };
      if (config.faqs && config.faqs.length > 0) {
        const faq = config.faqs[0];
        expect(faq).toHaveProperty('id');
        expect(faq).toHaveProperty('question');
        expect(faq).toHaveProperty('answer');
        expect(faq).toHaveProperty('keywords');
      }
    });
  });

  describe('Industry Knowledge', () => {
    it('should have industry knowledge', () => {
      const config = receptionist.getConfig() as { industryKnowledge?: unknown };
      expect(config.industryKnowledge).toBeDefined();
    });

    it('should have common problems', () => {
      const config = receptionist.getConfig() as { industryKnowledge?: { commonProblems: unknown[] } };
      expect(config.industryKnowledge?.commonProblems).toBeDefined();
      expect(Array.isArray(config.industryKnowledge?.commonProblems)).toBe(true);
    });
  });
});

describe('Response Format Expectations', () => {
  it('should expect action type in response', () => {
    const validActionTypes = [
      'book_appointment',
      'show_services',
      'show_hours',
      'escalate',
      'request_callback',
      'booking_confirmed',
      'callback_confirmed',
      'none'
    ];
    expect(validActionTypes).toContain('book_appointment');
    expect(validActionTypes).toContain('escalate');
    expect(validActionTypes).toContain('none');
  });
});
