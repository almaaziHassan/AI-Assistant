import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne } from '../../db/database';
import { AdminService } from '../admin';
import { Appointment, BookingRequest } from './types';
import servicesConfig from '../../config/services.json';
import { getDayOfWeek } from './utils';
import { isDateInPast, isDateTooFarAhead, isTimeSlotInPast } from './validation';
import { getAppointment } from './queries';
import { convertMinutesToMs } from '../../constants/time';

type Config = typeof servicesConfig;

// Simple mutex for preventing race conditions
const bookingLocks = new Map<string, boolean>();

export async function bookAppointment(
    request: BookingRequest,
    config: Config,
    adminService: AdminService
): Promise<Appointment> {
    // Normalize input (middleware sanitizes, we just trim here)
    const normalizedRequest = {
        ...request,
        customerName: request.customerName.trim(),
        customerEmail: request.customerEmail.trim().toLowerCase(),
        customerPhone: request.customerPhone.trim(),
        date: request.date.trim(),
        time: request.time.trim()
    };

    // Quick validations (no DB calls)
    if (isDateInPast(normalizedRequest.date)) {
        throw new Error('Cannot book appointments in the past');
    }

    if (isDateTooFarAhead(normalizedRequest.date, config.appointmentSettings.maxAdvanceBookingDays)) {
        throw new Error(`Cannot book more than ${config.appointmentSettings.maxAdvanceBookingDays} days in advance`);
    }

    // Check for closed days (no DB call - uses config)
    const dayOfWeek = getDayOfWeek(normalizedRequest.date);
    const hours = config.hours[dayOfWeek as keyof typeof config.hours];
    if (!hours.open || !hours.close) {
        throw new Error(`Sorry, we are closed on ${dayOfWeek}s`);
    }

    // Verify service exists (single DB call)
    const service = adminService.getService(normalizedRequest.serviceId);
    if (!service) {
        throw new Error('Selected service not found');
    }

    // Verify staff member exists (single DB call - not getAllStaff!)
    if (!normalizedRequest.staffId) {
        throw new Error('Please select a staff member');
    }
    const staffMember = adminService.getStaff(normalizedRequest.staffId);
    if (!staffMember) {
        throw new Error('Selected staff member not found');
    }

    // Create lock key for race condition protection
    const lockKey = `${normalizedRequest.date}-${normalizedRequest.time}-${normalizedRequest.staffId}`;

    if (bookingLocks.get(lockKey)) {
        throw new Error('This time slot is currently being booked. Please try again.');
    }

    bookingLocks.set(lockKey, true);

    try {
        // OPTIMIZED: Direct conflict check instead of generating all slots
        // Check if this specific staff member has a conflicting appointment
        const conflictCheck = getOne(
            `SELECT id FROM appointments 
       WHERE staff_id = ? 
       AND appointment_date = ? 
       AND status IN ('pending', 'confirmed')
       AND (
         (appointment_time <= ? AND time(appointment_time, '+' || duration || ' minutes') > ?)
         OR (appointment_time < time(?, '+' || ? || ' minutes') AND appointment_time >= ?)
       )`,
            [
                normalizedRequest.staffId,
                normalizedRequest.date,
                normalizedRequest.time,
                normalizedRequest.time,
                normalizedRequest.time,
                service.duration,
                normalizedRequest.time
            ]
        );

        if (conflictCheck) {
            throw new Error('Sorry, this time slot was just booked. Please select another time.');
        }

        // Check if time is in the past (for today)
        if (isTimeSlotInPast(normalizedRequest.date, normalizedRequest.time)) {
            throw new Error('Cannot book a time slot in the past');
        }

        // Create appointment
        const id = uuidv4();
        const now = new Date().toISOString();

        const appointment: Appointment = {
            id,
            customerName: normalizedRequest.customerName,
            customerEmail: normalizedRequest.customerEmail,
            customerPhone: normalizedRequest.customerPhone,
            serviceId: normalizedRequest.serviceId,
            serviceName: service.name,
            staffId: normalizedRequest.staffId,
            staffName: staffMember.name,
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
        bookingLocks.delete(lockKey);
    }
}

export function cancelAppointment(id: string): boolean {
    const existing = getAppointment(id);
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

export function updateAppointmentStatus(
    id: string,
    status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled',
    timezoneOffset?: number
): { success: boolean; error?: string } {
    const existing = getAppointment(id);
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
