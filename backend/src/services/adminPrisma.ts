/**
 * Admin Service - Prisma Implementation
 * 
 * This is the enterprise-grade version of the admin service using Prisma ORM.
 * Benefits over raw SQL:
 * - Type-safe queries (compile-time error checking)
 * - No SQL injection vulnerabilities
 * - Auto-generated types from schema
 * - Cleaner, more maintainable code
 * - Built-in relation handling
 */

import prisma from '../db/prisma';
import type { Staff, Service, Location, Holiday, Appointment, Callback } from '@prisma/client';

// Re-export Prisma types with our interface names
export type { Staff, Service, Location, Holiday, Appointment, Callback };

// Custom types for schedule (stored as JSON)
export interface DailySchedule {
    start: string; // HH:mm
    end: string;   // HH:mm
}

export interface WeeklySchedule {
    monday: DailySchedule | null;
    tuesday: DailySchedule | null;
    wednesday: DailySchedule | null;
    thursday: DailySchedule | null;
    friday: DailySchedule | null;
    saturday: DailySchedule | null;
    sunday: DailySchedule | null;
}

// Dashboard stats interface
export interface DashboardStats {
    todayAppointments: number;
    weekAppointments: number;
    monthAppointments: number;
    totalRevenue: number;
    cancelledCount: number;
    upcomingCount: number;
    pendingCallbacksCount: number;
    topServices: { serviceId: string; serviceName: string; count: number }[];
}

// Input types for create/update operations
export interface CreateStaffInput {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    services?: string[];
    schedule?: WeeklySchedule;
    color?: string;
    isActive?: boolean;
}

export interface CreateServiceInput {
    id?: string;
    name: string;
    description?: string;
    duration: number;
    price?: number;
    isActive?: boolean;
    displayOrder?: number;
}

export interface CreateHolidayInput {
    date: Date;
    name: string;
    isClosed?: boolean;
    customHoursOpen?: Date;
    customHoursClose?: Date;
}

/**
 * AdminService using Prisma ORM
 * All methods are now async and return proper Prisma types
 */
export class AdminServicePrisma {

    // ============ STAFF MANAGEMENT ============

    async createStaff(data: CreateStaffInput): Promise<Staff> {
        return prisma.staff.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role ?? 'staff',
                services: data.services ?? [],
                schedule: data.schedule as object ?? null,
                color: data.color,
                isActive: data.isActive ?? true,
            },
        });
    }

    async getStaff(id: string): Promise<Staff | null> {
        return prisma.staff.findUnique({
            where: { id },
        });
    }

    async getAllStaff(activeOnly: boolean = false): Promise<Staff[]> {
        return prisma.staff.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { name: 'asc' },
        });
    }

    async updateStaff(id: string, data: Partial<CreateStaffInput>): Promise<Staff | null> {
        const existing = await this.getStaff(id);
        if (!existing) return null;

        return prisma.staff.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.role !== undefined && { role: data.role }),
                ...(data.services !== undefined && { services: data.services }),
                ...(data.schedule !== undefined && { schedule: data.schedule as object }),
                ...(data.color !== undefined && { color: data.color }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
    }

    async deleteStaff(id: string): Promise<boolean> {
        const existing = await this.getStaff(id);
        if (!existing) return false;

        await prisma.staff.delete({ where: { id } });
        return true;
    }

    // ============ SERVICE MANAGEMENT ============

    async createService(data: CreateServiceInput): Promise<Service> {
        // Generate ID from name if not provided
        const id = data.id ?? data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Get next display order
        const maxOrder = await prisma.service.aggregate({
            _max: { displayOrder: true },
        });
        const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

        return prisma.service.create({
            data: {
                id,
                name: data.name,
                description: data.description,
                duration: data.duration,
                price: data.price ?? 0,
                isActive: data.isActive ?? true,
                displayOrder: data.displayOrder ?? nextOrder,
            },
        });
    }

    async getService(id: string): Promise<Service | null> {
        return prisma.service.findUnique({
            where: { id },
        });
    }

    async getAllServices(activeOnly: boolean = false): Promise<Service[]> {
        return prisma.service.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        });
    }

    async updateService(id: string, data: Partial<CreateServiceInput>): Promise<Service | null> {
        const existing = await this.getService(id);
        if (!existing) return null;

        return prisma.service.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.duration !== undefined && { duration: data.duration }),
                ...(data.price !== undefined && { price: data.price }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
            },
        });
    }

    async deleteService(id: string): Promise<boolean> {
        const existing = await this.getService(id);
        if (!existing) return false;

        await prisma.service.delete({ where: { id } });
        return true;
    }

    // ============ LOCATION MANAGEMENT ============

    async createLocation(data: { name: string; address?: string; phone?: string; isActive?: boolean }): Promise<Location> {
        return prisma.location.create({
            data: {
                name: data.name,
                address: data.address,
                phone: data.phone,
                isActive: data.isActive ?? true,
            },
        });
    }

    async getLocation(id: string): Promise<Location | null> {
        return prisma.location.findUnique({
            where: { id },
        });
    }

    async getAllLocations(activeOnly: boolean = false): Promise<Location[]> {
        return prisma.location.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { name: 'asc' },
        });
    }

    async deleteLocation(id: string): Promise<boolean> {
        const existing = await this.getLocation(id);
        if (!existing) return false;

        await prisma.location.delete({ where: { id } });
        return true;
    }

    // ============ HOLIDAY MANAGEMENT ============

    async createHoliday(data: CreateHolidayInput): Promise<Holiday> {
        return prisma.holiday.create({
            data: {
                date: data.date,
                name: data.name,
                isClosed: data.isClosed ?? true,
                customHoursOpen: data.customHoursOpen,
                customHoursClose: data.customHoursClose,
            },
        });
    }

    async getHoliday(id: string): Promise<Holiday | null> {
        return prisma.holiday.findUnique({
            where: { id },
        });
    }

    async getHolidayByDate(date: Date): Promise<Holiday | null> {
        return prisma.holiday.findUnique({
            where: { date },
        });
    }

    async getAllHolidays(futureOnly: boolean = false): Promise<Holiday[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.holiday.findMany({
            where: futureOnly ? { date: { gte: today } } : undefined,
            orderBy: { date: 'asc' },
        });
    }

    async deleteHoliday(id: string): Promise<boolean> {
        const existing = await this.getHoliday(id);
        if (!existing) return false;

        await prisma.holiday.delete({ where: { id } });
        return true;
    }

    // ============ ANALYTICS & DASHBOARD ============

    async getDashboardStats(): Promise<DashboardStats> {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Run all counts in parallel for performance
        const [
            todayAppointments,
            weekAppointments,
            monthAppointments,
            cancelledCount,
            upcomingCount,
            pendingCallbacksCount,
            topServicesRaw,
        ] = await Promise.all([
            // Today's appointments
            prisma.appointment.count({
                where: {
                    appointmentDate: today,
                    status: { in: ['confirmed', 'completed'] },
                },
            }),

            // Week appointments
            prisma.appointment.count({
                where: {
                    appointmentDate: { gte: weekAgo },
                    status: { in: ['confirmed', 'completed'] },
                },
            }),

            // Month appointments
            prisma.appointment.count({
                where: {
                    appointmentDate: { gte: monthAgo },
                    status: { in: ['confirmed', 'completed'] },
                },
            }),

            // Cancelled count
            prisma.appointment.count({
                where: {
                    appointmentDate: { gte: monthAgo },
                    status: 'cancelled',
                },
            }),

            // Upcoming appointments
            prisma.appointment.count({
                where: {
                    status: { in: ['pending', 'confirmed'] },
                    appointmentDate: { gte: today },
                },
            }),

            // Pending callbacks
            prisma.callback.count({
                where: { status: 'pending' },
            }),

            // Top services (grouped)
            prisma.appointment.groupBy({
                by: ['serviceId', 'serviceName'],
                where: { appointmentDate: { gte: monthAgo } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            }),
        ]);

        const topServices = topServicesRaw.map(row => ({
            serviceId: row.serviceId,
            serviceName: row.serviceName,
            count: row._count.id,
        }));

        return {
            todayAppointments,
            weekAppointments,
            monthAppointments,
            totalRevenue: monthAppointments * 100, // Placeholder
            cancelledCount,
            upcomingCount,
            pendingCallbacksCount,
            topServices,
        };
    }

    // ============ APPOINTMENT QUERIES ============

    async getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
        return prisma.appointment.findMany({
            where: {
                appointmentDate: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
            include: {
                staff: true,
                location: true,
            },
        });
    }

    async getAllAppointments(options: {
        status?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<Appointment[]> {
        return prisma.appointment.findMany({
            where: options.status ? { status: options.status } : undefined,
            orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
            take: options.limit,
            skip: options.offset,
            include: {
                staff: true,
                location: true,
            },
        });
    }

    async updateAppointmentStatus(id: string, status: string): Promise<Appointment | null> {
        return prisma.appointment.update({
            where: { id },
            data: { status },
        });
    }
}

// Export singleton instance
export const adminServicePrisma = new AdminServicePrisma();
