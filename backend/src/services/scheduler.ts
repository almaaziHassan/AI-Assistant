import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../db/database';
import servicesConfig from '../config/services.json';
import { adminService, AdminService, WeeklySchedule } from './admin';
import { TIME_CONSTANTS, getDaysAgoISO, convertMinutesToMs } from '../constants/time';
import { STATS_PERIODS } from '../constants/business';

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
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
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
  staffId: string;  // Required - must select a staff member
  date: string;
  time: string;
  notes?: string;
}

// Simple mutex for preventing race conditions
const bookingLocks = new Map<string, boolean>();

export class SchedulerService {
  private config: typeof servicesConfig;
  private adminService: AdminService;

  constructor(
    config = servicesConfig,
    adminSvc: AdminService = adminService
  ) {
    this.config = config;
    this.adminService = adminSvc;
  }

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
  // timezoneOffset: minutes offset from UTC (e.g., -300 for EST, +300 for IST)
  private isTimeSlotInPast(date: string, time: string, timezoneOffset?: number): boolean {
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

  // Check for duplicate booking (same email, same date, same time, same staff)
  // Note: Customer CAN book same time with DIFFERENT staff members
  private hasDuplicateBooking(email: string, date: string, serviceId: string, time: string, staffId: string): boolean {
    const existing = getAll(
      `SELECT id FROM appointments
       WHERE customer_email = ? AND appointment_date = ? AND service_id = ? AND appointment_time = ? AND staff_id = ? AND status IN ('pending', 'confirmed')`,
      [email.toLowerCase(), date, serviceId, time, staffId]
    );
    return existing.length > 0;
  }

  getAvailableSlots(date: string, serviceId: string, staffId?: string, timezoneOffset?: number): TimeSlot[] {
    // 1. Validations
    if (!this.isValidDateFormat(date) || this.isDateInPast(date) || this.isDateTooFarAhead(date)) {
      return [];
    }

    const service = this.adminService.getService(serviceId);
    if (!service) return [];

    // 2. Determine Business Open/Close (Outer Bounds)
    let businessOpen = '';
    let businessClose = '';

    // Check Holiday
    const holiday = this.adminService.getHolidayByDate(date);
    if (holiday) {
      if (holiday.isClosed) return [];
      if (holiday.customHoursOpen && holiday.customHoursClose) {
        businessOpen = holiday.customHoursOpen;
        businessClose = holiday.customHoursClose;
      } else {
        // Fallback to regular hours if holiday doesn't specify custom ones
        const dayOfWeek = this.getDayOfWeek(date);
        const h = this.config.hours[dayOfWeek as keyof typeof this.config.hours];
        if (!h.open || !h.close) return [];
        businessOpen = h.open;
        businessClose = h.close;
      }
    } else {
      const dayOfWeek = this.getDayOfWeek(date);
      const h = this.config.hours[dayOfWeek as keyof typeof this.config.hours];
      if (!h.open || !h.close) return [];
      businessOpen = h.open;
      businessClose = h.close;
    }

    // 3. Get Relevant Staff
    let relevantStaff = [];
    if (staffId) {
      const s = this.adminService.getStaff(staffId);
      if (s) relevantStaff.push(s);
    } else {
      // Get all active staff who provide this service
      relevantStaff = this.adminService.getAllStaff(true).filter(s =>
        !s.services || s.services.length === 0 || s.services.includes(serviceId)
      );
    }

    if (relevantStaff.length === 0) return [];

    // 4. Get ALL appointments for this date
    // We fetch all to be efficient, then filter in memory/loop
    const allAppointments = getAll(
      `SELECT appointment_time, duration, staff_id FROM appointments 
          WHERE appointment_date = ? AND status IN ('pending', 'confirmed')`,
      [date]
    ) as { appointment_time: string; duration: number; staff_id: string }[];

    // 5. Generate Slots
    // Optimization: Calculate time integers once
    const slots: TimeSlot[] = [];
    const slotDuration = this.config.appointmentSettings.slotDuration;
    const buffer = this.config.appointmentSettings.bufferBetweenAppointments;

    let currentTime = this.timeToMinutes(businessOpen);
    const closeTime = this.timeToMinutes(businessClose);
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;
    const dayOfWeek = this.getDayOfWeek(date);

    while (currentTime + service.duration <= closeTime) {
      const timeStr = this.minutesToTime(currentTime);

      // Check if past (respecting timezone)
      if (isToday && this.isTimeSlotInPast(date, timeStr, timezoneOffset)) {
        currentTime += slotDuration;
        continue;
      }

      // Check if ANY relevant staff is available
      const isAnyStaffAvailable = relevantStaff.some(staff => {
        // A. Check Staff Schedule
        if (staff.schedule) {
          const schedule = staff.schedule[dayOfWeek as keyof WeeklySchedule];
          if (!schedule) return false; // Staff is OFF today

          const shiftStart = this.timeToMinutes(schedule.start);
          const shiftEnd = this.timeToMinutes(schedule.end);

          // Required: [currentTime, currentTime + duration] IS SUBSET OF [shiftStart, shiftEnd]
          if (currentTime < shiftStart || (currentTime + service.duration) > shiftEnd) {
            return false;
          }
        }
        // If no schedule defined, they work full business hours (checked by outer loop)

        // B. Check Staff Booking Conflicts
        const staffApts = allAppointments.filter(a => a.staff_id === staff.id);
        const hasConflict = staffApts.some(apt => {
          const aptStart = this.timeToMinutes(apt.appointment_time);
          const aptEnd = aptStart + apt.duration + buffer;
          const slotEnd = currentTime + service.duration;

          return (
            (currentTime >= aptStart && currentTime < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (currentTime <= aptStart && slotEnd >= aptEnd)
          );
        });

        return !hasConflict;
      });

      slots.push({ time: timeStr, available: isAnyStaffAvailable });
      currentTime += slotDuration;
    }

    return slots;
  }

  // Generate slots for custom hours (holidays, special days)
  private generateSlotsForHours(date: string, serviceId: string, openTime: string, closeTime: string, staffId?: string): TimeSlot[] {
    const service = this.adminService.getService(serviceId);
    if (!service) {
      return [];
    }

    // Get existing appointments - filter by staff if provided
    let existingAppointments: { appointment_time: string; duration: number }[];

    if (staffId) {
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND staff_id = ? AND status IN ('pending', 'confirmed')`,
        [date, staffId]
      ) as { appointment_time: string; duration: number }[];
    } else {
      existingAppointments = getAll(
        `SELECT appointment_time, duration FROM appointments
         WHERE appointment_date = ? AND status IN ('pending', 'confirmed')`,
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

    // Verify service exists in database
    const service = this.adminService.getService(normalizedRequest.serviceId);
    if (!service) {
      throw new Error('Selected service not found');
    }

    // Verify staff member is selected
    if (!normalizedRequest.staffId) {
      throw new Error('Please select a staff member');
    }

    // Check for duplicate booking (same email, date, service, time, AND staff)
    if (this.hasDuplicateBooking(normalizedRequest.customerEmail, normalizedRequest.date, normalizedRequest.serviceId, normalizedRequest.time, normalizedRequest.staffId)) {
      throw new Error('You already have this exact booking with this staff member');
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
        const staffMember = this.adminService.getAllStaff().find(s => s.id === normalizedRequest.staffId);
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
        status: 'pending',
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

  // Update appointment status
  updateAppointmentStatus(id: string, status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled', timezoneOffset?: number): { success: boolean; error?: string } {
    const existing = this.getAppointment(id);
    if (!existing) {
      return { success: false, error: 'Appointment not found' };
    }

    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled', 'no-show'],
      'confirmed': ['cancelled', 'completed', 'no-show'],
      'completed': [],  // Final state
      'no-show': [],    // Final state
      'cancelled': []   // Final state
    };

    const allowedNextStatuses = validTransitions[existing.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      return { success: false, error: `Cannot change status from ${existing.status} to ${status}` };
    }

    // For confirmed/completed/no-show, appointment time must have passed
    // Only cancellation is allowed for future appointments
    // Default to Pakistan timezone (UTC+5, offset = -300) if no timezone provided
    if (status === 'confirmed' || status === 'completed' || status === 'no-show') {
      // Use provided timezone or default to Pakistan (UTC+5 = -300 minutes offset)
      const tz = timezoneOffset !== undefined ? timezoneOffset : -300;

      // Get current time in client's timezone
      const now = new Date();
      const clientNow = new Date(now.getTime() - convertMinutesToMs(tz));

      // Parse appointment datetime - stored as local time strings (e.g., "2024-12-31" and "15:15")
      // Create appointment datetime as if it's in the same timezone reference
      const appointmentDateTime = new Date(`${existing.appointmentDate}T${existing.appointmentTime}:00`);

      // Compare appointment time with current client time
      // Note: Both are now in the same reference frame (UTC for comparison)
      const appointmentInClientTz = new Date(appointmentDateTime.getTime());

      if (appointmentInClientTz > clientNow) {
        const appointmentTimeStr = existing.appointmentTime;
        return {
          success: false,
          error: `Cannot mark as ${status}. Appointment is scheduled for ${existing.appointmentDate} at ${appointmentTimeStr}. You can only cancel future appointments.`
        };
      }
    }

    runQuery(
      "UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?",
      [status, new Date().toISOString(), id]
    );

    return { success: true };
  }

  // Get past appointments that need action (still marked as confirmed but time has passed)
  getAppointmentsNeedingAction(): Appointment[] {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Get appointments where:
    // 1. Status is 'confirmed' AND
    // 2. (Date is before today) OR (Date is today AND appointment end time has passed)
    const rows = getAll(
      `SELECT * FROM appointments
       WHERE status = 'confirmed'
       AND (
         appointment_date < ?
         OR (appointment_date = ? AND time(appointment_time, '+' || duration || ' minutes') <= time(?))
       )
       ORDER BY appointment_date DESC, appointment_time DESC`,
      [today, today, currentTime]
    );

    return rows.map(row => this.rowToAppointment(row));
  }

  // Get appointment statistics including no-shows
  getAppointmentStats(): {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    noShowRate: number;
  } {
    // All-time stats
    const stats = getOne(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
       FROM appointments`
    ) as { total: number; pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };

    // No-show rate for last 30 days only
    const monthAgo = getDaysAgoISO(STATS_PERIODS.LAST_MONTH_DAYS);
    const monthStats = getOne(
      `SELECT
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_show
       FROM appointments WHERE appointment_date >= ?`,
      [monthAgo]
    ) as { completed: number; no_show: number } | undefined;

    const completed30d = monthStats?.completed || 0;
    const noShow30d = monthStats?.no_show || 0;
    const finishedAppointments30d = completed30d + noShow30d;
    const noShowRate = finishedAppointments30d > 0
      ? Math.round((noShow30d / finishedAppointments30d) * 100)
      : 0;

    return {
      total: stats.total,
      pending: stats.pending,
      confirmed: stats.confirmed,
      completed: stats.completed,
      cancelled: stats.cancelled,
      noShow: stats.no_show,
      noShowRate
    };
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
    return hours * TIME_CONSTANTS.MINUTES_PER_HOUR + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / TIME_CONSTANTS.MINUTES_PER_HOUR);
    const mins = minutes % TIME_CONSTANTS.MINUTES_PER_HOUR;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
