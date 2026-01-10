import {
    createStaff, getStaff, getAllStaff, updateStaff, deleteStaff
} from './staff';
import {
    createLocation, getLocation, getAllLocations, updateLocation, deleteLocation
} from './locations';
import {
    createService, getService, getAllServices, updateService, deleteService
} from './services';
import {
    createHoliday, getHoliday, getHolidayByDate, getAllHolidays, updateHoliday, deleteHoliday
} from './holidays';
import {
    getDashboardStats, getAppointmentsForDateRange, getAllAppointments
} from './analytics';
import {
    createFAQ, getFAQ, getAllFAQs, updateFAQ, deleteFAQ,
    getSystemSetting, getAllSystemSettings, setSystemSetting
} from './systemSettings';
import { Staff, Location, Service, Holiday, DashboardStats, WeeklySchedule, FAQ, SystemSetting } from './types';

// Re-export types
export * from './types';

export class AdminService {
    // ============ STAFF MANAGEMENT ============
    createStaff(data: Omit<Staff, 'id' | 'createdAt'>): Staff {
        return createStaff(data);
    }

    getStaff(id: string): Staff | null {
        return getStaff(id);
    }

    getAllStaff(activeOnly: boolean = false): Staff[] {
        return getAllStaff(activeOnly);
    }

    updateStaff(id: string, data: Partial<Omit<Staff, 'id' | 'createdAt'>>): Staff | null {
        return updateStaff(id, data);
    }

    deleteStaff(id: string): boolean {
        return deleteStaff(id);
    }

    // ============ LOCATION MANAGEMENT ============
    createLocation(data: Omit<Location, 'id' | 'createdAt'>): Location {
        return createLocation(data);
    }

    getLocation(id: string): Location | null {
        return getLocation(id);
    }

    getAllLocations(activeOnly: boolean = false): Location[] {
        return getAllLocations(activeOnly);
    }

    updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'createdAt'>>): Location | null {
        return updateLocation(id, data);
    }

    deleteLocation(id: string): boolean {
        return deleteLocation(id);
    }

    // ============ SERVICE MANAGEMENT ============
    createService(data: Omit<Service, 'id' | 'createdAt'>): Service {
        return createService(data);
    }

    getService(id: string): Service | null {
        return getService(id);
    }

    getAllServices(activeOnly: boolean = false): Service[] {
        return getAllServices(activeOnly);
    }

    updateService(id: string, data: Partial<Omit<Service, 'id' | 'createdAt'>>): Service | null {
        return updateService(id, data);
    }

    deleteService(id: string): boolean {
        return deleteService(id);
    }

    // ============ HOLIDAY MANAGEMENT ============
    createHoliday(data: Omit<Holiday, 'id' | 'createdAt'>): Holiday {
        return createHoliday(data);
    }

    getHoliday(id: string): Holiday | null {
        return getHoliday(id);
    }

    getHolidayByDate(date: string): Holiday | null {
        return getHolidayByDate(date);
    }

    getAllHolidays(futureOnly: boolean = false): Holiday[] {
        return getAllHolidays(futureOnly);
    }

    updateHoliday(id: string, data: Partial<Omit<Holiday, 'id' | 'createdAt'>>): Holiday | null {
        return updateHoliday(id, data);
    }

    deleteHoliday(id: string): boolean {
        return deleteHoliday(id);
    }

    // ============ ANALYTICS & DASHBOARD ============
    getDashboardStats(): DashboardStats {
        return getDashboardStats();
    }

    getAppointmentsForDateRange(startDate: string, endDate: string): Record<string, unknown>[] {
        return getAppointmentsForDateRange(startDate, endDate);
    }

    getAllAppointments(options: { status?: string; limit?: number; offset?: number } = {}): Record<string, unknown>[] {
        return getAllAppointments(options);
    }

    // ============ KNOWLEDGE BASE (FAQs & Settings) ============
    createFAQ(data: Omit<FAQ, 'id' | 'createdAt' | 'updatedAt'>): FAQ {
        return createFAQ(data);
    }

    getFAQ(id: string): FAQ | null {
        return getFAQ(id);
    }

    getAllFAQs(activeOnly: boolean = false): FAQ[] {
        return getAllFAQs(activeOnly);
    }

    updateFAQ(id: string, data: Partial<Omit<FAQ, 'id' | 'createdAt' | 'updatedAt'>>): FAQ | null {
        return updateFAQ(id, data);
    }

    deleteFAQ(id: string): boolean {
        return deleteFAQ(id);
    }

    getSystemSetting(key: string): SystemSetting | null {
        return getSystemSetting(key);
    }

    getAllSystemSettings(): SystemSetting[] {
        return getAllSystemSettings();
    }

    setSystemSetting(key: string, value: any, description?: string): SystemSetting {
        return setSystemSetting(key, value, description);
    }
}

export const adminService = new AdminService();
