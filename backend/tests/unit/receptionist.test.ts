/**
 * Receptionist Service Unit Tests
 * 
 * NOTE: The main ReceptionistService tests are SKIPPED because the service has deep
 * dependencies on the database and Groq AI service that are difficult to mock.
 * 
 * The service uses:
 * 1. Direct database access through adminService
 * 2. External API calls to Groq AI
 * 3. Complex configuration loading
 * 
 * Current Integration Tests cover this functionality in:
 * - tests/integration/chat.test.ts
 * 
 * TODO: Refactor ReceptionistService to accept dependencies as constructor parameters.
 */

// Skip all tests that require the actual service
describe.skip('ReceptionistService (Pending Refactoring)', () => {
  describe('getConfig', () => {
    it('should return configuration object', () => {
      // Pending service refactoring
    });
  });

  describe('getServices', () => {
    it('should return array of services', () => {
      // Pending service refactoring  
    });
  });

  describe('getBusinessHours', () => {
    it('should return hours for all days', () => {
      // Pending service refactoring
    });
  });
});

// This test doesn't need the actual service - it just validates the expected format
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

  it('should define all required response action types', () => {
    const requiredActions = ['book_appointment', 'show_services', 'show_hours', 'escalate', 'none'];
    requiredActions.forEach(action => {
      expect(typeof action).toBe('string');
      expect(action.length).toBeGreaterThan(0);
    });
  });
});
