
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import servicesConfig from '../../src/config/services.json';

// Mocks MUST be defined before imports that use them
const mockPrismaFunctions = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
};

const mockClient = {
    appointment: mockPrismaFunctions,
    callback: { count: jest.fn() },
    $queryRaw: jest.fn(),
};

jest.mock('../../src/db/prisma', () => {
    return {
        __esModule: true,
        default: mockClient
    };
});

// Import AFTER mock
import prisma from '../../src/db/prisma';
import { SchedulerServicePrisma } from '../../src/services/schedulerPrisma';
import { AdminServicePrisma } from '../../src/services/adminPrisma';

// Mock AdminService
const mockAdminService = {
    getService: jest.fn(),
    getHolidayByDate: jest.fn(),
    getStaff: jest.fn(),
    getAllStaff: jest.fn(),
} as unknown as AdminServicePrisma;

describe('SchedulerServicePrisma', () => {
    let scheduler: SchedulerServicePrisma;

    beforeEach(() => {
        jest.clearAllMocks();
        scheduler = new SchedulerServicePrisma(servicesConfig, mockAdminService);
    });

    it('initializes correctly', () => {
        expect(scheduler).toBeDefined();
    });

    describe('getAvailableSlots', () => {
        const testDate = '2026-01-20'; // Within 30 days of 2026-01-12

        it('should return slots for a valid service and date', async () => {
            (mockAdminService.getService as any).mockResolvedValue({
                id: 'service-1',
                duration: 30,
                name: 'Test Service'
            });
            (mockAdminService.getHolidayByDate as any).mockResolvedValue(null);

            // Mock empty existing appointments
            (prisma.appointment.findMany as any).mockResolvedValue([]);

            const slots = await scheduler.getAvailableSlots(testDate, 'service-1');

            expect(slots.length).toBeGreaterThan(0);
            expect(slots[0]).toHaveProperty('time');
            expect(slots[0]).toHaveProperty('available', true);
            expect(prisma.appointment.findMany).toHaveBeenCalled();
        });

        it('should mark conflicting slots as unavailable', async () => {
            (mockAdminService.getService as any).mockResolvedValue({
                id: 'service-1',
                duration: 30,
                name: 'Test Service'
            });
            (mockAdminService.getHolidayByDate as any).mockResolvedValue(null);

            (prisma.appointment.findMany as any).mockResolvedValue([
                {
                    appointmentTime: new Date(`${testDate}T09:00:00`),
                    duration: 30,
                }
            ]);

            const slots = await scheduler.getAvailableSlots(testDate, 'service-1');

            const slot9am = slots.find(s => s.time === '09:00');
            const slot930 = slots.find(s => s.time === '09:30');

            expect(slot9am).toBeDefined();
            expect(slot9am?.available).toBe(false);
            expect(slot930?.available).toBe(true);
        });
    });

    describe('bookAppointment', () => {
        const validRequest = {
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            customerPhone: '+15551234567',
            serviceId: 'service-1',
            staffId: 'staff-1',
            date: '2026-01-20',
            time: '09:00',
            notes: 'Test note'
        };

        it('should successfully book an appointment', async () => {
            (mockAdminService.getService as any).mockResolvedValue({
                id: 'service-1',
                name: 'Test Service',
                duration: 30
            });
            (mockAdminService.getAllStaff as any).mockResolvedValue([
                { id: 'staff-1', name: 'Dr. Smith' }
            ]);

            (prisma.appointment.findFirst as any).mockResolvedValue(null);
            (prisma.appointment.findMany as any).mockResolvedValue([]);

            (prisma.appointment.create as any).mockResolvedValue({
                id: 'new-apt-id',
                ...validRequest,
                serviceName: 'Test Service',
                staffName: 'Dr. Smith',
                appointmentDate: new Date(validRequest.date),
                appointmentTime: new Date(`1970-01-01T${validRequest.time}:00`),
                duration: 30,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const result = await scheduler.bookAppointment(validRequest);

            expect(result.id).toBe('new-apt-id');
            expect(result.status).toBe('pending');
            expect(prisma.appointment.create).toHaveBeenCalled();
        });

        it('should fail if service does not exist', async () => {
            (mockAdminService.getService as any).mockResolvedValue(null);

            await expect(scheduler.bookAppointment(validRequest))
                .rejects.toThrow('Selected service not found');
        });

        it('should fail if time slot duplicate', async () => {
            (mockAdminService.getService as any).mockResolvedValue({ id: 's1', duration: 30 });

            (prisma.appointment.findFirst as any).mockResolvedValue({
                id: 'existing',
                appointmentTime: new Date(`1970-01-01T${validRequest.time}:00`),
                appointmentDate: new Date(validRequest.date),
            });

            await expect(scheduler.bookAppointment(validRequest))
                .rejects.toThrow('You already have this exact booking');
        });
    });
});
