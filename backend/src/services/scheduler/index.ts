import servicesConfig from '../../config/services.json';
import { adminService, AdminService } from '../admin';
import { Appointment, TimeSlot, BookingRequest } from './types';
import { getAvailableSlots, generateSlotsForHours } from './availability';
import { bookAppointment, cancelAppointment, updateAppointmentStatus } from './booking';
import {
    getAppointment,
    getAppointmentsByEmail,
    getAppointmentsByDate,
    getAppointmentsNeedingAction,
    getAppointmentStats
} from './queries';

// Re-export types for consumers
export * from './types';

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

    getAvailableSlots(date: string, serviceId: string, staffId?: string, timezoneOffset?: number): TimeSlot[] {
        return getAvailableSlots(date, serviceId, this.config, this.adminService, staffId, timezoneOffset);
    }

    // Exposed for specific use cases (e.g. testing or admin overrides) if needed,
    // matching original private method pattern but now potentially accessible if we want,
    // but keeping it 'private' in TS sense to match interface implies it wasn't public.
    // The original class had it private. I'll just keep it private if not used.
    // Wait, I can't easily proxy a private method if it's not defined on the class.
    // If no one calls it from outside, I don't need to define it here.
    // But let's check if usage exists. It was private.
    // private generateSlotsForHours(...)

    async bookAppointment(request: BookingRequest): Promise<Appointment> {
        return bookAppointment(request, this.config, this.adminService);
    }

    getAppointment(id: string): Appointment | null {
        return getAppointment(id);
    }

    getAppointmentsByEmail(email: string): Appointment[] {
        return getAppointmentsByEmail(email);
    }

    getAppointmentsByDate(date: string): Appointment[] {
        return getAppointmentsByDate(date);
    }

    cancelAppointment(id: string): boolean {
        return cancelAppointment(id);
    }

    updateAppointmentStatus(id: string, status: 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled', timezoneOffset?: number): { success: boolean; error?: string } {
        return updateAppointmentStatus(id, status, timezoneOffset);
    }

    getAppointmentsNeedingAction(): Appointment[] {
        return getAppointmentsNeedingAction();
    }

    getAppointmentStats() {
        return getAppointmentStats();
    }
}
