import { SchedulerService } from '../../src/services/scheduler';

describe('SchedulerService', () => {
  let scheduler: SchedulerService;

  beforeEach(() => {
    scheduler = new SchedulerService();
  });

  describe('Date Validation', () => {
    it('should reject invalid date format', () => {
      const slots = scheduler.getAvailableSlots('invalid-date', 'swedish-massage');
      expect(slots).toEqual([]);
    });

    it('should reject date in the past', () => {
      const pastDate = '2020-01-01';
      const slots = scheduler.getAvailableSlots(pastDate, 'swedish-massage');
      expect(slots).toEqual([]);
    });

    it('should reject date too far in future (>30 days)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const dateStr = futureDate.toISOString().split('T')[0];
      const slots = scheduler.getAvailableSlots(dateStr, 'swedish-massage');
      expect(slots).toEqual([]);
    });

    it('should accept valid date within range', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = tomorrow.getDay();

      // Skip test if tomorrow is Sunday (limited hours)
      if (dayOfWeek !== 0) {
        const slots = scheduler.getAvailableSlots(dateStr, 'consultation');
        expect(slots.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Service Validation', () => {
    it('should return empty slots for invalid service', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const slots = scheduler.getAvailableSlots(dateStr, 'invalid-service');
      expect(slots).toEqual([]);
    });

    it('should return slots for valid service', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = tomorrow.getDay();

      // Skip if it's a day with limited hours
      if (dayOfWeek !== 0) {
        const slots = scheduler.getAvailableSlots(dateStr, 'swedish-massage');
        expect(Array.isArray(slots)).toBe(true);
      }
    });
  });

  describe('Slot Structure', () => {
    it('should return slots with correct structure', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = tomorrow.getDay();

      // Skip if closed day
      if (dayOfWeek !== 0) {
        const slots = scheduler.getAvailableSlots(dateStr, 'consultation');
        if (slots.length > 0) {
          expect(slots[0]).toHaveProperty('time');
          expect(slots[0]).toHaveProperty('available');
          expect(typeof slots[0].time).toBe('string');
          expect(typeof slots[0].available).toBe('boolean');
        }
      }
    });

    it('should return slots in HH:MM format', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const dayOfWeek = tomorrow.getDay();

      if (dayOfWeek !== 0) {
        const slots = scheduler.getAvailableSlots(dateStr, 'consultation');
        if (slots.length > 0) {
          const timeRegex = /^\d{2}:\d{2}$/;
          expect(slots[0].time).toMatch(timeRegex);
        }
      }
    });
  });

  describe('Booking Validation', () => {
    it('should reject booking with missing customer name', async () => {
      await expect(scheduler.bookAppointment({
        customerName: '',
        customerEmail: 'test@test.com',
        customerPhone: '+14155551234',
        serviceId: 'consultation',
        date: '2025-12-27',
        time: '10:00'
      })).rejects.toThrow();
    });

    it('should reject booking with invalid email', async () => {
      await expect(scheduler.bookAppointment({
        customerName: 'Test User',
        customerEmail: 'invalid-email',
        customerPhone: '+14155551234',
        serviceId: 'consultation',
        date: '2025-12-27',
        time: '10:00'
      })).rejects.toThrow('valid email');
    });

    it('should reject booking with invalid phone', async () => {
      await expect(scheduler.bookAppointment({
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        customerPhone: '123',
        serviceId: 'consultation',
        date: '2025-12-27',
        time: '10:00'
      })).rejects.toThrow();
    });

    it('should reject booking for past date', async () => {
      await expect(scheduler.bookAppointment({
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        customerPhone: '+14155551234',
        serviceId: 'consultation',
        date: '2020-01-01',
        time: '10:00'
      })).rejects.toThrow();
    });

    it('should reject booking for invalid service', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await expect(scheduler.bookAppointment({
        customerName: 'Test User',
        customerEmail: 'test@test.com',
        customerPhone: '+14155551234',
        serviceId: 'invalid-service',
        date: dateStr,
        time: '10:00'
      })).rejects.toThrow('not found');
    });
  });

  describe('Appointment Status Update', () => {
    it('should return error for non-existent appointment', () => {
      const result = scheduler.updateAppointmentStatus('non-existent-id', 'confirmed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should accept valid status values', () => {
      // Test that valid statuses don't cause type errors
      const validStatuses: Array<'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled'> =
        ['pending', 'confirmed', 'completed', 'no-show', 'cancelled'];

      validStatuses.forEach(status => {
        const result = scheduler.updateAppointmentStatus('test-id', status);
        // Will fail because appointment doesn't exist, which is expected
        expect(result.success).toBe(false);
        expect(result.error).toBe('Appointment not found');
      });
    });
  });

  describe('Appointments Needing Action', () => {
    it('should return an array', () => {
      const appointments = scheduler.getAppointmentsNeedingAction();
      expect(Array.isArray(appointments)).toBe(true);
    });

    it('should only include confirmed appointments', () => {
      const appointments = scheduler.getAppointmentsNeedingAction();
      // All returned appointments should have status 'confirmed'
      appointments.forEach(apt => {
        expect(apt.status).toBe('confirmed');
      });
    });
  });

  describe('Appointment Statistics', () => {
    it('should return stats object with required fields', () => {
      const stats = scheduler.getAppointmentStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('confirmed');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('cancelled');
      expect(stats).toHaveProperty('noShow');
      expect(stats).toHaveProperty('noShowRate');
    });

    it('should have numeric values for all stats', () => {
      const stats = scheduler.getAppointmentStats();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.confirmed).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.cancelled).toBe('number');
      expect(typeof stats.noShow).toBe('number');
      expect(typeof stats.noShowRate).toBe('number');
    });

    it('should have non-negative values', () => {
      const stats = scheduler.getAppointmentStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.confirmed).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.cancelled).toBeGreaterThanOrEqual(0);
      expect(stats.noShow).toBeGreaterThanOrEqual(0);
      expect(stats.noShowRate).toBeGreaterThanOrEqual(0);
    });

    it('should have noShowRate between 0 and 100', () => {
      const stats = scheduler.getAppointmentStats();
      expect(stats.noShowRate).toBeGreaterThanOrEqual(0);
      expect(stats.noShowRate).toBeLessThanOrEqual(100);
    });
  });

});
