import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../db/database';
import servicesConfig from '../config/services.json';
import { adminService } from './admin';

export interface Appointment {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  staffId?: string;
  staffName?: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface BookingRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  staffId?: string;
  date: string;
  time: string;
  notes?: string;
}

// Simple mutex for preventing race conditions
const bookingLocks = new Map<string, boolean>();

export class SchedulerService {
  private config = servicesConfig;

  // Validate date format (YYYY-MM-DD)
  private isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }

  // Check if date is in the past
  private isDateInPast(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    return checkDate < today;
  }

  // Check if date is too far in advance
  private isDateTooFarAhead(date: string): boolean {
    const maxDays = this.config.appointmentSettings.maxAdvanceBookingDays;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxDays);
    const checkDate = new Date(date);
    return checkDate > maxDate;
  }

  // Check if time slot is in the past (for today's bookings)
  private isTimeSlotInPast(date: string, time: string): boolean {
    const now = new Date();
    const slotDateTime = new Date(`${date}T${time}:00`);
    return slotDateTime <= now;
  }

  // Validate email format
  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // Country-specific phone validation rules (length-based only for flexibility)
  // Handles mobile, landline, and VoIP numbers
  private countryPhoneRules: Record<string, { minLength: number; maxLength: number; name: string }> = {
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

  // Validate phone format with country code
  private isValidPhone(phone: string): { valid: boolean; error?: string } {
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
      if (this.countryPhoneRules[potentialCode]) {
        matchedRule = this.countryPhoneRules[potentialCode];
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

  // Check for duplicate booking (same email, same date, same time)
  private hasDuplicateBooking(email: string, date: string, serviceId: string, time: string): boolean {
    const existing = getAll(
      `SELECT id FROM appointments
       WHERE customer_email = ? AND appointment_date = ? AND service_id = ? AND appointment_time = ? AND status = 'confirmed'`,
      [email.toLowerCase(), date, serviceId, time]
    );
    return existing.length > 0;
  }

  getAvailableSlots(date: string, serviceId: string, staffId?: string): TimeSlot[] {
    // Validate date format
    if (!this.isValidDateFormat(date)) {
      return [];
    }

    // Check if date is in past
    if (this.isDateInPast(date)) {
      return [];
    }

    // Check if date is too far ahead
    if (this.isDateTooFarAhead(date)) {
      return [];
    }

    // Check for holidays
    const holiday = adminService.getHolidayByDate(date);
    if (holiday) {
      // If closed on this holiday
      if (holiday.isClosed) {
        return [];
      }
      // Use custom hours if available
      if (holiday.customHoursOpen && holiday.customHoursClose) {
        return this.generateSlotsForHours(date, serviceId, holiday.customHoursOpen, holiday.customHoursClose, staffId);
      }
    }

    const dayOfWeek = this.getDayOfWeek(date);
    const hours = this.config.hours[dayOfWeek as keyof typeof this.config.hours];

    // If closed on this day
    if (!hours.open || !hours.close) {
      return [];
    }

    const service = this.config.services.find(s => s.id === serviceId);
    if (!service) {
      return [];
    }

    // Get existing appointments for this date
    // If staffId is provided, only get appointments for that staff member
    // If no staffId, get ALL appointments (for general availability or "any staff" option)
    let existingAppointments: { appointment_time: string; duration: number }[];

    if (staffId) {
      // Staff-specific: only check this staff's appointments
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND staff_id = ? AND status = 'confirmed'`,
        [date, staffId]
      ) as { appointment_time: string; duration: number }[];
    } else {
      // No staff selected: check ALL staff appointments to find any available slot
      // This is for when user hasn't selected a specific staff yet
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND status = 'confirmed'`,
        [date]
      ) as { appointment_time: string; duration: number }[];
    }

    // Generate all possible time slots
    const slots: TimeSlot[] = [];
    const slotDuration = this.config.appointmentSettings.slotDuration;
    const buffer = this.config.appointmentSettings.bufferBetweenAppointments;

    let currentTime = this.timeToMinutes(hours.open);
    const closeTime = this.timeToMinutes(hours.close);

    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    while (currentTime + service.duration <= closeTime) {
      const timeStr = this.minutesToTime(currentTime);

      // Skip past time slots for today
      if (isToday && this.isTimeSlotInPast(date, timeStr)) {
        currentTime += slotDuration;
        continue;
      }

      // Check if this slot conflicts with existing appointments
      const isAvailable = !existingAppointments.some(apt => {
        const aptStart = this.timeToMinutes(apt.appointment_time);
        const aptEnd = aptStart + apt.duration + buffer;
        const slotEnd = currentTime + service.duration;

        // Check for overlap
        return (
          (currentTime >= aptStart && currentTime < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (currentTime <= aptStart && slotEnd >= aptEnd)
        );
      });

      slots.push({
        time: timeStr,
        available: isAvailable
      });

      currentTime += slotDuration;
    }

    return slots;
  }

  // Generate slots for custom hours (holidays, special days)
  private generateSlotsForHours(date: string, serviceId: string, openTime: string, closeTime: string, staffId?: string): TimeSlot[] {
    const service = this.config.services.find(s => s.id === serviceId);
    if (!service) {
      return [];
    }

    // Get existing appointments - filter by staff if provided
    let existingAppointments: { appointment_time: string; duration: number }[];

    if (staffId) {
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND staff_id = ? AND status = 'confirmed'`,
        [date, staffId]
      ) as { appointment_time: string; duration: number }[];
    } else {
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND status = 'confirmed'`,
        [date]
      ) as { appointment_time: string; duration: number }[];
    }

    const slots: TimeSlot[] = [];
    const slotDuration = this.config.appointmentSettings.slotDuration;
    const buffer = this.config.appointmentSettings.bufferBetweenAppointments;

    let currentTime = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);

    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    while (currentTime + service.duration <= closeMinutes) {
      const timeStr = this.minutesToTime(currentTime);

      if (isToday && this.isTimeSlotInPast(date, timeStr)) {
        currentTime += slotDuration;
        continue;
      }

      const isAvailable = !existingAppointments.some(apt => {
        const aptStart = this.timeToMinutes(apt.appointment_time);
        const aptEnd = aptStart + apt.duration + buffer;
        const slotEnd = currentTime + service.duration;
        return (
          (currentTime >= aptStart && currentTime < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (currentTime <= aptStart && slotEnd >= aptEnd)
        );
      });

      slots.push({ time: timeStr, available: isAvailable });
      currentTime += slotDuration;
    }

    return slots;
  }

  async bookAppointment(request: BookingRequest): Promise<Appointment> {
    // Trim and normalize input
    const normalizedRequest = {
      ...request,
      customerName: request.customerName.trim(),
      customerEmail: request.customerEmail.trim().toLowerCase(),
      customerPhone: request.customerPhone.trim(),
      date: request.date.trim(),
      time: request.time.trim()
    };

    // Validate required fields
    if (!normalizedRequest.customerName || normalizedRequest.customerName.length < 2) {
      throw new Error('Please provide a valid name (at least 2 characters)');
    }

    if (!this.isValidEmail(normalizedRequest.customerEmail)) {
      throw new Error('Please provide a valid email address');
    }

    const phoneValidation = this.isValidPhone(normalizedRequest.customerPhone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error || 'Please provide a valid phone number with country code');
    }

    // Validate date
    if (!this.isValidDateFormat(normalizedRequest.date)) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD');
    }

    if (this.isDateInPast(normalizedRequest.date)) {
      throw new Error('Cannot book appointments in the past');
    }

    if (this.isDateTooFarAhead(normalizedRequest.date)) {
      throw new Error(`Cannot book more than ${this.config.appointmentSettings.maxAdvanceBookingDays} days in advance`);
    }

    // Check for closed days
    const dayOfWeek = this.getDayOfWeek(normalizedRequest.date);
    const hours = this.config.hours[dayOfWeek as keyof typeof this.config.hours];
    if (!hours.open || !hours.close) {
      throw new Error(`Sorry, we are closed on ${dayOfWeek}s`);
    }

    // Verify service exists
    const service = this.config.services.find(s => s.id === normalizedRequest.serviceId);
    if (!service) {
      throw new Error('Selected service not found');
    }

    // Check for duplicate booking (same email, date, service, and time)
    if (this.hasDuplicateBooking(normalizedRequest.customerEmail, normalizedRequest.date, normalizedRequest.serviceId, normalizedRequest.time)) {
      throw new Error('You already have this exact booking');
    }

    // Create lock key for this specific slot
    const lockKey = `${normalizedRequest.date}-${normalizedRequest.time}`;

    // Check if slot is being booked (race condition protection)
    if (bookingLocks.get(lockKey)) {
      throw new Error('This time slot is currently being booked. Please try again.');
    }

    // Acquire lock
    bookingLocks.set(lockKey, true);

    try {
      // Re-check availability (double-check after acquiring lock)
      // Pass staffId to check availability for the specific staff member
      const slots = this.getAvailableSlots(normalizedRequest.date, normalizedRequest.serviceId, normalizedRequest.staffId);
      const slot = slots.find(s => s.time === normalizedRequest.time);

      if (!slot) {
        throw new Error('Selected time slot is not valid for this date');
      }

      if (!slot.available) {
        throw new Error('Sorry, this time slot was just booked. Please select another time.');
      }

      // Check if time is in the past (for today)
      if (this.isTimeSlotInPast(normalizedRequest.date, normalizedRequest.time)) {
        throw new Error('Cannot book a time slot in the past');
      }

      // Create appointment
      const id = uuidv4();
      const now = new Date().toISOString();

      // Get staff name if staffId provided
      let staffName: string | undefined;
      if (normalizedRequest.staffId) {
        const staffMember = adminService.getAllStaff().find(s => s.id === normalizedRequest.staffId);
        staffName = staffMember?.name;
      }

      const appointment: Appointment = {
        id,
        customerName: normalizedRequest.customerName,
        customerEmail: normalizedRequest.customerEmail,
        customerPhone: normalizedRequest.customerPhone,
        serviceId: normalizedRequest.serviceId,
        serviceName: service.name,
        staffId: normalizedRequest.staffId,
        staffName,
        appointmentDate: normalizedRequest.date,
        appointmentTime: normalizedRequest.time,
        duration: service.duration,
        status: 'confirmed',
        notes: normalizedRequest.notes?.trim(),
        createdAt: now,
        updatedAt: now
      };

      runQuery(
        `INSERT INTO appointments (
          id, customer_name, customer_email, customer_phone,
          service_id, service_name, staff_id, staff_name,
          appointment_date, appointment_time,
          duration, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appointment.id,
          appointment.customerName,
          appointment.customerEmail,
          appointment.customerPhone,
          appointment.serviceId,
          appointment.serviceName,
          appointment.staffId || null,
          appointment.staffName || null,
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment.duration,
          appointment.status,
          appointment.notes || null,
          appointment.createdAt,
          appointment.updatedAt
        ]
      );

      return appointment;
    } finally {
      // Release lock
      bookingLocks.delete(lockKey);
    }
  }

  getAppointment(id: string): Appointment | null {
    const row = getOne('SELECT * FROM appointments WHERE id = ?', [id]);

    if (!row) return null;

    return this.rowToAppointment(row);
  }

  getAppointmentsByEmail(email: string): Appointment[] {
    const rows = getAll(
      'SELECT * FROM appointments WHERE customer_email = ? ORDER BY appointment_date, appointment_time',
      [email.toLowerCase()]
    );

    return rows.map(row => this.rowToAppointment(row));
  }

  getAppointmentsByDate(date: string): Appointment[] {
    const rows = getAll(
      'SELECT * FROM appointments WHERE appointment_date = ? ORDER BY appointment_time',
      [date]
    );

    return rows.map(row => this.rowToAppointment(row));
  }

  cancelAppointment(id: string): boolean {
    const existing = this.getAppointment(id);
    if (!existing) return false;

    // Check if appointment is in the past
    const appointmentDateTime = new Date(`${existing.appointmentDate}T${existing.appointmentTime}:00`);
    if (appointmentDateTime < new Date()) {
      return false; // Cannot cancel past appointments
    }

    runQuery(
      "UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );

    return true;
  }

  private rowToAppointment(row: Record<string, unknown>): Appointment {
    return {
      id: row.id as string,
      customerName: row.customer_name as string,
      customerEmail: row.customer_email as string,
      customerPhone: row.customer_phone as string,
      serviceId: row.service_id as string,
      serviceName: row.service_name as string,
      staffId: row.staff_id as string | undefined,
      staffName: row.staff_name as string | undefined,
      appointmentDate: row.appointment_date as string,
      appointmentTime: row.appointment_time as string,
      duration: row.duration as number,
      status: row.status as Appointment['status'],
      notes: row.notes as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  private getDayOfWeek(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
