/**
 * Scheduler Service - Prisma Implementation
 * 
 * Handles appointment booking, availability, and scheduling using Prisma ORM.
 */

import prisma from '../db/prisma';
import servicesConfig from '../config/services.json';
import { adminServicePrisma, AdminServicePrisma, WeeklySchedule } from './adminPrisma';
import { TIME_CONSTANTS, getDaysAgoISO, convertMinutesToMs } from '../constants/time';
import { STATS_PERIODS } from '../constants/business';
import type { Appointment as PrismaAppointment } from '@prisma/client';

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
    staffId: string;
    date: string;
    time: string;
    notes?: string;
}

// Simple mutex for preventing race conditions
const bookingLocks = new Map<string, boolean>();

export class SchedulerServicePrisma {
    private config: typeof servicesConfig;
    private adminService: AdminServicePrisma;

    constructor(
        config = servicesConfig,
        adminSvc: AdminServicePrisma = adminServicePrisma
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

    // Check if time slot is in the past
    private isTimeSlotInPast(date: string, time: string, timezoneOffset?: number): boolean {
        const now = new Date();
        if (timezoneOffset !== undefined) {
            const clientNow = new Date(now.getTime() - convertMinutesToMs(timezoneOffset));
            const slotDateTime = new Date(`${date}T${time}:00`);
            return slotDateTime <= clientNow;
        }
        const slotDateTime = new Date(`${date}T${time}:00`);
        return slotDateTime <= now;
    }

    // Validate email format
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate phone format
    private isValidPhone(phone: string): { valid: boolean; error?: string } {
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (!cleaned.startsWith('+')) {
            return { valid: false, error: 'Phone number must start with country code (e.g., +1, +92)' };
        }
        const digits = cleaned.substring(1);
        if (digits.length < 10 || digits.length > 15) {
            return { valid: false, error: 'Phone number must be 10-15 digits after country code' };
        }
        return { valid: true };
    }

    // Check for duplicate booking
    private async hasDuplicateBooking(
        email: string,
        date: string,
        serviceId: string,
        time: string,
        staffId: string
    ): Promise<boolean> {
        const existing = await prisma.appointment.findFirst({
            where: {
                customerEmail: email.toLowerCase(),
                appointmentDate: new Date(date),
                serviceId,
                staffId,
                status: { notIn: ['cancelled'] },
            },
        });
        return !!existing;
    }

    // Get available time slots
    async getAvailableSlots(
        date: string,
        serviceId: string,
        staffId?: string,
        timezoneOffset?: number
    ): Promise<TimeSlot[]> {
        // Get service duration from database
        const service = await this.adminService.getService(serviceId);
        const duration = service?.duration || 30;

        // Get day of week
        const dayOfWeek = this.getDayOfWeek(date);
        const hours = this.config.hours[dayOfWeek as keyof typeof this.config.hours];

        if (!hours.open || !hours.close) {
            return []; // Closed this day
        }

        // Check for holidays
        const holiday = await this.adminService.getHolidayByDate(new Date(date));
        if (holiday?.isClosed) {
            return []; // Closed for holiday
        }

        // Generate all possible slots
        const slots: TimeSlot[] = [];
        const openMinutes = this.timeToMinutes(hours.open);
        const closeMinutes = this.timeToMinutes(hours.close);

        // Get existing appointments for this date
        const existingAppointments = await prisma.appointment.findMany({
            where: {
                appointmentDate: new Date(date),
                status: { notIn: ['cancelled'] },
                ...(staffId && { staffId }),
            },
        });

        // Get staff working hours if staffId provided
        let staffSchedule: WeeklySchedule | null = null;
        if (staffId) {
            const staff = await this.adminService.getStaff(staffId);
            if (staff?.schedule) {
                staffSchedule = staff.schedule as unknown as WeeklySchedule;
            }
        }

        // Generate slots
        for (let minutes = openMinutes; minutes + duration <= closeMinutes; minutes += 30) {
            const time = this.minutesToTime(minutes);

            // Check if slot is in past
            if (this.isTimeSlotInPast(date, time, timezoneOffset)) {
                continue;
            }

            // Check staff schedule
            if (staffSchedule) {
                const daySchedule = staffSchedule[dayOfWeek as keyof WeeklySchedule];
                if (!daySchedule) {
                    continue; // Staff not working this day
                }
                const staffStart = this.timeToMinutes(daySchedule.start);
                const staffEnd = this.timeToMinutes(daySchedule.end);
                if (minutes < staffStart || minutes + duration > staffEnd) {
                    continue;
                }
            }

            // Check for conflicts with existing appointments
            const slotEndMinutes = minutes + duration;
            const hasConflict = existingAppointments.some(apt => {
                const aptTime = apt.appointmentTime as unknown as Date;
                const aptTimeStr = aptTime instanceof Date
                    ? `${aptTime.getHours().toString().padStart(2, '0')}:${aptTime.getMinutes().toString().padStart(2, '0')}`
                    : String(aptTime);
                const aptStart = this.timeToMinutes(aptTimeStr);
                const aptEnd = aptStart + apt.duration;
                return (minutes < aptEnd && slotEndMinutes > aptStart);
            });

            slots.push({
                time,
                available: !hasConflict,
            });
        }

        return slots;
    }

    // Book an appointment
    async bookAppointment(request: BookingRequest): Promise<Appointment> {
        const normalizedRequest = {
            ...request,
            customerName: request.customerName.trim(),
            customerEmail: request.customerEmail.trim().toLowerCase(),
            customerPhone: request.customerPhone.trim(),
            date: request.date.trim(),
            time: request.time.trim(),
        };

        // Validations
        if (!normalizedRequest.customerName || normalizedRequest.customerName.length < 2) {
            throw new Error('Please provide a valid name (at least 2 characters)');
        }

        if (!this.isValidEmail(normalizedRequest.customerEmail)) {
            throw new Error('Please provide a valid email address');
        }

        const phoneValidation = this.isValidPhone(normalizedRequest.customerPhone);
        if (!phoneValidation.valid) {
            throw new Error(phoneValidation.error || 'Please provide a valid phone number');
        }

        if (!this.isValidDateFormat(normalizedRequest.date)) {
            throw new Error('Invalid date format. Please use YYYY-MM-DD');
        }

        if (this.isDateInPast(normalizedRequest.date)) {
            throw new Error('Cannot book appointments in the past');
        }

        if (this.isDateTooFarAhead(normalizedRequest.date)) {
            throw new Error(`Cannot book more than ${this.config.appointmentSettings.maxAdvanceBookingDays} days in advance`);
        }

        // Check closed days
        const dayOfWeek = this.getDayOfWeek(normalizedRequest.date);
        const hours = this.config.hours[dayOfWeek as keyof typeof this.config.hours];
        if (!hours.open || !hours.close) {
            throw new Error(`Sorry, we are closed on ${dayOfWeek}s`);
        }

        // Verify service exists
        const service = await this.adminService.getService(normalizedRequest.serviceId);
        if (!service) {
            throw new Error('Selected service not found');
        }

        if (!normalizedRequest.staffId) {
            throw new Error('Please select a staff member');
        }

        // Check for duplicate
        if (await this.hasDuplicateBooking(
            normalizedRequest.customerEmail,
            normalizedRequest.date,
            normalizedRequest.serviceId,
            normalizedRequest.time,
            normalizedRequest.staffId
        )) {
            throw new Error('You already have this exact booking');
        }

        // Lock mechanism
        const lockKey = `${normalizedRequest.date}-${normalizedRequest.time}`;
        if (bookingLocks.get(lockKey)) {
            throw new Error('This time slot is currently being booked. Please try again.');
        }

        bookingLocks.set(lockKey, true);

        try {
            // Re-check availability
            const slots = await this.getAvailableSlots(
                normalizedRequest.date,
                normalizedRequest.serviceId,
                normalizedRequest.staffId
            );
            const slot = slots.find(s => s.time === normalizedRequest.time);

            if (!slot || !slot.available) {
                throw new Error('Sorry, this time slot was just booked. Please select another time.');
            }

            if (this.isTimeSlotInPast(normalizedRequest.date, normalizedRequest.time)) {
                throw new Error('Cannot book a time slot in the past');
            }

            // Get staff name
            const allStaff = await this.adminService.getAllStaff();
            const staffMember = allStaff.find(s => s.id === normalizedRequest.staffId);
            const staffName = staffMember?.name;

            // Create appointment in database
            const appointment = await prisma.appointment.create({
                data: {
                    customerName: normalizedRequest.customerName,
                    customerEmail: normalizedRequest.customerEmail,
                    customerPhone: normalizedRequest.customerPhone,
                    serviceId: normalizedRequest.serviceId,
                    serviceName: service.name,
                    staffId: normalizedRequest.staffId,
                    staffName: staffName || null,
                    appointmentDate: new Date(normalizedRequest.date),
                    appointmentTime: new Date(`1970-01-01T${normalizedRequest.time}:00`),
                    duration: service.duration,
                    status: 'pending',
                    notes: normalizedRequest.notes?.trim() || null,
                },
            });

            return this.prismaToAppointment(appointment);
        } finally {
            bookingLocks.delete(lockKey);
        }
    }

    // Get appointment by ID
    async getAppointment(id: string): Promise<Appointment | null> {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });
        return appointment ? this.prismaToAppointment(appointment) : null;
    }

    // Get appointments by email
    async getAppointmentsByEmail(email: string): Promise<Appointment[]> {
        const appointments = await prisma.appointment.findMany({
            where: { customerEmail: email.toLowerCase() },
            orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
        });
        return appointments.map(apt => this.prismaToAppointment(apt));
    }

    // Get appointments by date
    async getAppointmentsByDate(date: string): Promise<Appointment[]> {
        const appointments = await prisma.appointment.findMany({
            where: { appointmentDate: new Date(date) },
            orderBy: { appointmentTime: 'asc' },
        });
        return appointments.map(apt => this.prismaToAppointment(apt));
    }

    // Cancel appointment
    async cancelAppointment(id: string): Promise<boolean> {
        const existing = await this.getAppointment(id);
        if (!existing) return false;

        const appointmentDateTime = new Date(`${existing.appointmentDate}T${existing.appointmentTime}:00`);
        if (appointmentDateTime < new Date()) {
            return false; // Cannot cancel past appointments
        }

        await prisma.appointment.update({
            where: { id },
            data: { status: 'cancelled', updatedAt: new Date() },
        });

        return true;
    }

    // Update appointment status
    async updateAppointmentStatus(
        id: string,
        status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled',
        timezoneOffset?: number
    ): Promise<{ success: boolean; error?: string }> {
        const existing = await this.getAppointment(id);
        if (!existing) {
            return { success: false, error: 'Appointment not found' };
        }

        const validTransitions: Record<string, string[]> = {
            'pending': ['confirmed', 'cancelled', 'no-show'],
            'confirmed': ['cancelled', 'completed', 'no-show'],
            'completed': [],
            'no-show': [],
            'cancelled': [],
        };

        const allowedNextStatuses = validTransitions[existing.status] || [];
        if (!allowedNextStatuses.includes(status)) {
            return { success: false, error: `Cannot change status from ${existing.status} to ${status}` };
        }

        // Time validation for certain status changes
        if (status === 'confirmed' || status === 'completed' || status === 'no-show') {
            const tz = timezoneOffset !== undefined ? timezoneOffset : -300;
            const now = new Date();
            const clientNow = new Date(now.getTime() - convertMinutesToMs(tz));
            const appointmentDateTime = new Date(`${existing.appointmentDate}T${existing.appointmentTime}:00`);

            if (appointmentDateTime > clientNow) {
                return {
                    success: false,
                    error: `Cannot mark as ${status}. Appointment is in the future.`,
                };
            }
        }

        await prisma.appointment.update({
            where: { id },
            data: { status, updatedAt: new Date() },
        });

        return { success: true };
    }

    // Get appointments needing action
    async getAppointmentsNeedingAction(): Promise<Appointment[]> {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const appointments = await prisma.appointment.findMany({
            where: {
                status: 'confirmed',
                appointmentDate: { lte: new Date(today) },
            },
            orderBy: [{ appointmentDate: 'desc' }, { appointmentTime: 'desc' }],
        });

        return appointments.map(apt => this.prismaToAppointment(apt));
    }

    // Get appointment statistics
    async getAppointmentStats(): Promise<{
        total: number;
        pending: number;
        confirmed: number;
        completed: number;
        cancelled: number;
        noShow: number;
        noShowRate: number;
    }> {
        const [total, pending, confirmed, completed, cancelled, noShow] = await Promise.all([
            prisma.appointment.count(),
            prisma.appointment.count({ where: { status: 'pending' } }),
            prisma.appointment.count({ where: { status: 'confirmed' } }),
            prisma.appointment.count({ where: { status: 'completed' } }),
            prisma.appointment.count({ where: { status: 'cancelled' } }),
            prisma.appointment.count({ where: { status: 'no-show' } }),
        ]);

        // Calculate no-show rate for last 30 days
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - STATS_PERIODS.LAST_MONTH_DAYS);

        const [completed30d, noShow30d] = await Promise.all([
            prisma.appointment.count({
                where: { status: 'completed', appointmentDate: { gte: monthAgo } },
            }),
            prisma.appointment.count({
                where: { status: 'no-show', appointmentDate: { gte: monthAgo } },
            }),
        ]);

        const finished30d = completed30d + noShow30d;
        const noShowRate = finished30d > 0 ? Math.round((noShow30d / finished30d) * 100) : 0;

        return { total, pending, confirmed, completed, cancelled, noShow, noShowRate };
    }

    // Convert Prisma appointment to our interface
    private prismaToAppointment(apt: PrismaAppointment): Appointment {
        const aptTime = apt.appointmentTime as unknown as Date;
        const timeStr = aptTime instanceof Date
            ? `${aptTime.getHours().toString().padStart(2, '0')}:${aptTime.getMinutes().toString().padStart(2, '0')}`
            : String(aptTime);

        const aptDate = apt.appointmentDate as unknown as Date;
        const dateStr = aptDate instanceof Date
            ? aptDate.toISOString().split('T')[0]
            : String(aptDate);

        return {
            id: apt.id,
            customerName: apt.customerName,
            customerEmail: apt.customerEmail,
            customerPhone: apt.customerPhone,
            serviceId: apt.serviceId,
            serviceName: apt.serviceName,
            staffId: apt.staffId || undefined,
            staffName: apt.staffName || undefined,
            appointmentDate: dateStr,
            appointmentTime: timeStr,
            duration: apt.duration,
            status: apt.status as Appointment['status'],
            notes: apt.notes || undefined,
            createdAt: apt.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: apt.updatedAt?.toISOString() || new Date().toISOString(),
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

export const schedulerServicePrisma = new SchedulerServicePrisma();
