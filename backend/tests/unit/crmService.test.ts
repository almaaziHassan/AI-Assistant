import { CRMService } from '../../src/services/crm';
import prisma from '../../src/db/prisma';

// Mock Prisma
jest.mock('../../src/db/prisma', () => {
    return {
        __esModule: true,
        default: {
            contactProfile: {
                findMany: jest.fn(),
                count: jest.fn(),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                upsert: jest.fn(),
            },
            appointment: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                groupBy: jest.fn(),
            },
            conversation: {
                findMany: jest.fn(),
            },
            callback: {
                findMany: jest.fn(),
            },
            user: {
                findMany: jest.fn(),
            }
        }
    };
});

describe('CRMService', () => {
    let crmService: CRMService;

    beforeEach(() => {
        jest.clearAllMocks();
        crmService = new CRMService();
    });

    describe('getContacts', () => {
        it('should return paginated contacts', async () => {
            const mockProfiles = [
                { id: '1', email: 'test@example.com', tags: [], user: { name: 'Test User' }, lastSeenAt: new Date() }
            ];

            (prisma.contactProfile.findMany as jest.Mock).mockResolvedValue(mockProfiles);
            (prisma.contactProfile.count as jest.Mock).mockResolvedValue(1);
            (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]); // For stats

            const result = await crmService.getContacts(1, 10);

            expect(result.contacts).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.contacts[0].name).toBe('Test User');
        });

        it('should filter VIP contacts', async () => {
            (prisma.contactProfile.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.contactProfile.count as jest.Mock).mockResolvedValue(0);

            await crmService.getContacts(1, 10, undefined, 'vip');

            expect(prisma.contactProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { tags: { array_contains: 'vip' } }
            }));
        });
    });

    describe('calculateCustomerStats (private)', () => {
        it('should calculate statistics correctly', async () => {
            const mockProfiles = [{ id: '1', email: 'stats@example.com', tags: [], lastSeenAt: new Date() }];
            const mockAppointments = [
                { status: 'completed', appointmentDate: new Date(), serviceId: '1' },
                { status: 'completed', appointmentDate: new Date(), serviceId: '1' },
            ];

            (prisma.contactProfile.findMany as jest.Mock).mockResolvedValue(mockProfiles);
            (prisma.contactProfile.count as jest.Mock).mockResolvedValue(1);
            (prisma.appointment.findMany as jest.Mock).mockResolvedValue(mockAppointments);

            const result = await crmService.getContacts(1, 10);
            const contact = result.contacts[0];

            expect(contact.stats.totalVisits).toBe(2);
            expect(contact.stats.totalSpend).toBe(100); // 2 * 50
        });
    });

    describe('updateProfile', () => {
        it('should update profile fields', async () => {
            await crmService.updateProfile('1', { notes: 'New Note' });
            expect(prisma.contactProfile.update).toHaveBeenCalledWith({
                where: { id: '1' },
                data: { notes: 'New Note' }
            });
        });
    });
});
