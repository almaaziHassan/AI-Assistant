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
