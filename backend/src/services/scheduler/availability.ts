import { getAll } from '../../db/database';
import { AdminService, WeeklySchedule } from '../admin';
import { TimeSlot } from './types';
import { isTimeSlotInPast, isValidDateFormat, isDateInPast, isDateTooFarAhead } from './validation';
import { timeToMinutes, minutesToTime, getDayOfWeek } from './utils';
import servicesConfig from '../../config/services.json';

type Config = typeof servicesConfig;

export function generateSlotsForHours(
    date: string,
    serviceId: string,
    openTime: string,
    closeTime: string,
    config: Config,
    adminService: AdminService,
    staffId?: string
): TimeSlot[] {
    const service = adminService.getService(serviceId);
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
    const slotDuration = config.appointmentSettings.slotDuration;
    const buffer = config.appointmentSettings.bufferBetweenAppointments;

    let currentTime = timeToMinutes(openTime);
    const closeMinutes = timeToMinutes(closeTime);

    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    while (currentTime + service.duration <= closeMinutes) {
        const timeStr = minutesToTime(currentTime);

        if (isToday && isTimeSlotInPast(date, timeStr)) {
            currentTime += slotDuration;
            continue;
        }

        const isAvailable = !existingAppointments.some(apt => {
            const aptStart = timeToMinutes(apt.appointment_time);
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

export function getAvailableSlots(
    date: string,
    serviceId: string,
    config: Config,
    adminService: AdminService,
    staffId?: string,
    timezoneOffset?: number
): TimeSlot[] {
    // 1. Validations
    if (!isValidDateFormat(date) || isDateInPast(date) || isDateTooFarAhead(date, config.appointmentSettings.maxAdvanceBookingDays)) {
        return [];
    }

    const service = adminService.getService(serviceId);
    if (!service) return [];

    // 2. Determine Business Open/Close (Outer Bounds)
    let businessOpen = '';
    let businessClose = '';

    // Check Holiday
    const holiday = adminService.getHolidayByDate(date);
    if (holiday) {
        if (holiday.isClosed) return [];
        if (holiday.customHoursOpen && holiday.customHoursClose) {
            businessOpen = holiday.customHoursOpen;
            businessClose = holiday.customHoursClose;
        } else {
            // Fallback to regular hours if holiday doesn't specify custom ones
            const dayOfWeek = getDayOfWeek(date);
            const h = config.hours[dayOfWeek as keyof typeof config.hours];
            if (!h.open || !h.close) return [];
            businessOpen = h.open;
            businessClose = h.close;
        }
    } else {
        const dayOfWeek = getDayOfWeek(date);
        const h = config.hours[dayOfWeek as keyof typeof config.hours];
        if (!h.open || !h.close) return [];
        businessOpen = h.open;
        businessClose = h.close;
    }

    // 3. Get Relevant Staff
    let relevantStaff = [];
    if (staffId) {
        const s = adminService.getStaff(staffId);
        if (s) relevantStaff.push(s);
    } else {
        // Get all active staff who provide this service
        relevantStaff = adminService.getAllStaff(true).filter(s =>
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
    const slotDuration = config.appointmentSettings.slotDuration;
    const buffer = config.appointmentSettings.bufferBetweenAppointments;

    let currentTime = timeToMinutes(businessOpen);
    const closeTime = timeToMinutes(businessClose);
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;
    const dayOfWeek = getDayOfWeek(date);

    while (currentTime + service.duration <= closeTime) {
        const timeStr = minutesToTime(currentTime);

        // Check if past (respecting timezone)
        if (isToday && isTimeSlotInPast(date, timeStr, timezoneOffset)) {
            currentTime += slotDuration;
            continue;
        }

        // Check if ANY relevant staff is available
        const isAnyStaffAvailable = relevantStaff.some(staff => {
            // A. Check Staff Schedule
            if (staff.schedule) {
                const schedule = staff.schedule[dayOfWeek as keyof WeeklySchedule];
                if (!schedule) return false; // Staff is OFF today

                const shiftStart = timeToMinutes(schedule.start);
                const shiftEnd = timeToMinutes(schedule.end);

                // Required: [currentTime, currentTime + duration] IS SUBSET OF [shiftStart, shiftEnd]
                if (currentTime < shiftStart || (currentTime + service.duration) > shiftEnd) {
                    return false;
                }
            }
            // If no schedule defined, they work full business hours (checked by outer loop)

            // B. Check Staff Booking Conflicts
            const staffApts = allAppointments.filter(a => a.staff_id === staff.id);
            const hasConflict = staffApts.some(apt => {
                const aptStart = timeToMinutes(apt.appointment_time);
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
