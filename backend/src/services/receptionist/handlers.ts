import { runQuery } from '../../db/database';
import { v4 as uuidv4 } from 'uuid';
import { BookingConfirmation, CallbackConfirmation } from './types';
import { SchedulerService } from '../scheduler';

const scheduler = new SchedulerService();

/**
 * Execute booking through the scheduler service
 */
export async function executeBooking(args: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceId: string;
    date: string;
    time: string;
    staffId: string;
}): Promise<{ success: boolean; confirmation?: BookingConfirmation; error?: string }> {
    try {
        const appointment = await scheduler.bookAppointment({
            customerName: args.customerName,
            customerEmail: args.customerEmail,
            customerPhone: args.customerPhone,
            serviceId: args.serviceId,
            date: args.date,
            time: args.time,
            staffId: args.staffId
        });

        return {
            success: true,
            confirmation: {
                id: appointment.id,
                serviceName: appointment.serviceName,
                staffName: appointment.staffName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                customerName: appointment.customerName,
                customerEmail: appointment.customerEmail
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Booking failed'
        };
    }
}

/**
 * Execute callback request - saves to database
 */
export function executeCallbackRequest(args: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    preferredTime?: string;
    concerns?: string;
}): { success: boolean; confirmation?: CallbackConfirmation; error?: string } {
    // Validate that we have real data, not placeholders
    const invalidValues = ['not provided', 'n/a', 'unknown', 'none', ''];
    const nameLower = (args.customerName || '').toLowerCase().trim();
    const phoneLower = (args.customerPhone || '').toLowerCase().trim();

    if (invalidValues.includes(nameLower) || nameLower.length < 2) {
        return { success: false, error: 'Valid customer name is required' };
    }
    if (invalidValues.includes(phoneLower) || phoneLower.length < 5) {
        return { success: false, error: 'Valid phone number is required' };
    }

    try {
        const id = uuidv4();
        const now = new Date().toISOString();

        runQuery(
            `INSERT INTO callbacks (id, customer_name, customer_phone, customer_email, preferred_time, concerns, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
                id,
                args.customerName.trim(),
                args.customerPhone.trim(),
                args.customerEmail?.trim() || null,
                args.preferredTime || null,
                args.concerns?.trim() || null,
                now
            ]
        );

        return {
            success: true,
            confirmation: {
                id,
                customerName: args.customerName,
                customerPhone: args.customerPhone,
                preferredTime: args.preferredTime
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Callback request failed'
        };
    }
}

// ========== APPOINTMENT MANAGEMENT HANDLERS ==========

/**
 * Appointment info returned from lookup
 */
export interface AppointmentInfo {
    id: string;
    serviceName: string;
    staffName?: string;
    date: string;
    time: string;
    status: string;
    customerName: string;
    customerEmail: string;
}

/**
 * Look up appointments by customer email
 * 
 * Why email-based: Email is unique identifier for appointments
 * Allows matching even if customer wasn't logged in when booking
 */
export function lookupAppointments(email: string): {
    success: boolean;
    appointments?: AppointmentInfo[];
    error?: string
} {
    try {
        // Validate email - AI sometimes calls with placeholder text
        if (!email || typeof email !== 'string') {
            return { success: false, error: 'Please provide your email address to look up appointments.' };
        }

        const emailLower = email.toLowerCase().trim();

        // Check for placeholder text the AI might incorrectly provide
        const invalidPatterns = [
            'please provide',
            'your email',
            'unknown',
            'not provided',
            'n/a',
            'none',
            'email address'
        ];

        if (invalidPatterns.some(p => emailLower.includes(p)) || emailLower.length < 5) {
            return { success: false, error: 'Please provide your email address to look up appointments.' };
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return { success: false, error: 'Please provide a valid email address (e.g., john@example.com).' };
        }

        const appointments = scheduler.getAppointmentsByEmail(emailLower);

        // Filter to only upcoming appointments (not past, not cancelled)
        const now = new Date();
        const upcoming = appointments.filter(apt => {
            if (apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'no-show') {
                return false;
            }
            const aptDate = new Date(apt.appointmentDate + 'T' + apt.appointmentTime);
            return aptDate > now;
        });

        if (upcoming.length === 0) {
            return {
                success: true,
                appointments: [],
            };
        }

        return {
            success: true,
            appointments: upcoming.map(apt => ({
                id: apt.id,
                serviceName: apt.serviceName,
                staffName: apt.staffName,
                date: apt.appointmentDate,
                time: apt.appointmentTime,
                status: apt.status,
                customerName: apt.customerName,
                customerEmail: apt.customerEmail
            }))
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to look up appointments'
        };
    }
}

/**
 * Cancel an appointment by ID
 * 
 * Why separate from lookup: Customer must confirm which appointment
 * This prevents accidental cancellations
 */
export function cancelAppointment(appointmentId: string, reason?: string): {
    success: boolean;
    cancelledAppointment?: AppointmentInfo;
    error?: string;
} {
    try {
        // Validate appointment ID - must be UUID format (from lookup_appointments)
        if (!appointmentId || typeof appointmentId !== 'string') {
            return { success: false, error: 'Please provide your email first so I can look up your appointments.' };
        }

        // UUID format check - prevents AI from making up IDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(appointmentId.trim())) {
            return { success: false, error: 'Please provide your email first so I can look up your appointments.' };
        }

        // Get appointment details first
        const appointment = scheduler.getAppointment(appointmentId);

        if (!appointment) {
            return { success: false, error: 'Appointment not found. Please provide your email so I can look up your appointments.' };
        }

        // Check if appointment is in the past
        const now = new Date();
        const aptDateTime = new Date(appointment.appointmentDate + 'T' + appointment.appointmentTime);
        if (aptDateTime < now) {
            return { success: false, error: 'Cannot cancel past appointments' };
        }

        // Check if already cancelled
        if (appointment.status === 'cancelled') {
            return { success: false, error: 'This appointment is already cancelled' };
        }

        // Cancel the appointment
        const success = scheduler.cancelAppointment(appointmentId);

        if (!success) {
            return { success: false, error: 'Failed to cancel appointment' };
        }

        return {
            success: true,
            cancelledAppointment: {
                id: appointment.id,
                serviceName: appointment.serviceName,
                staffName: appointment.staffName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                status: 'cancelled',
                customerName: appointment.customerName,
                customerEmail: appointment.customerEmail
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Cancellation failed'
        };
    }
}

/**
 * Get appointment details for rescheduling
 * 
 * Why return appointment details: Frontend needs service info to pre-fill form
 * Original appointment is cancelled only after new booking is confirmed
 */
export function getAppointmentForReschedule(appointmentId: string): {
    success: boolean;
    appointment?: AppointmentInfo & { serviceId: string; staffId?: string };
    error?: string;
} {
    try {
        // Validate appointment ID - must be UUID format (from lookup_appointments)
        if (!appointmentId || typeof appointmentId !== 'string') {
            return { success: false, error: 'Please provide your email first so I can look up your appointments.' };
        }

        // UUID format check - prevents AI from making up IDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(appointmentId.trim())) {
            return { success: false, error: 'Please provide your email first so I can look up your appointments.' };
        }

        const appointment = scheduler.getAppointment(appointmentId);

        if (!appointment) {
            return { success: false, error: 'Appointment not found. Please provide your email so I can look up your appointments.' };
        }

        // Check if appointment is in the past
        const now = new Date();
        const aptDateTime = new Date(appointment.appointmentDate + 'T' + appointment.appointmentTime);
        if (aptDateTime < now) {
            return { success: false, error: 'Cannot reschedule past appointments' };
        }

        // Check if already cancelled
        if (appointment.status === 'cancelled') {
            return { success: false, error: 'Cannot reschedule a cancelled appointment' };
        }

        return {
            success: true,
            appointment: {
                id: appointment.id,
                serviceName: appointment.serviceName,
                staffName: appointment.staffName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                status: appointment.status,
                customerName: appointment.customerName,
                customerEmail: appointment.customerEmail,
                serviceId: appointment.serviceId,
                staffId: appointment.staffId
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get appointment'
        };
    }
}

