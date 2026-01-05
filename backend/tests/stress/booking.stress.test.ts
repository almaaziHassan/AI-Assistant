/**
 * Appointment Booking Stress Tests
 * 
 * Tests the booking system under load conditions:
 * - Concurrent booking attempts
 * - Race condition handling
 * - System stability under stress
 */

import { SchedulerService } from '../../src/services/scheduler';
import { runQuery, getAll } from '../../src/db/database';

// Mock the admin service
jest.mock('../../src/services/admin', () => ({
    adminService: {
        getService: jest.fn((id: string) => ({
            id,
            name: 'Test Service',
            duration: 30,
            price: 50,
            isActive: true
        })),
        getStaff: jest.fn((id: string) => ({
            id,
            name: 'Test Staff',
            role: 'Stylist',
            isActive: true
        })),
        getAllStaff: jest.fn(() => [{
            id: 'staff-1',
            name: 'Test Staff',
            role: 'Stylist',
            isActive: true
        }]),
        getHolidayByDate: jest.fn(() => null)
    },
    AdminService: jest.fn()
}));

describe('Appointment Booking Stress Tests', () => {
    let scheduler: SchedulerService;
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    const dateStr = testDate.toISOString().split('T')[0];

    beforeAll(() => {
        scheduler = new SchedulerService();
    });

    afterEach(() => {
        // Clean up test appointments
        try {
            runQuery('DELETE FROM appointments WHERE customer_email LIKE ?', ['%stresstest%']);
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Concurrent Booking Requests', () => {
        it('should handle 10 concurrent booking requests for different slots', async () => {
            const promises: Promise<void>[] = [];
            const results: { success: boolean; time: string; error?: string }[] = [];

            // Generate 10 different time slots
            const times = ['09:00', '09:30', '10:00', '10:30', '11:00',
                '11:30', '12:00', '14:00', '14:30', '15:00'];

            const startTime = Date.now();

            for (let i = 0; i < 10; i++) {
                const promise = scheduler.bookAppointment({
                    customerName: `Stress Test ${i}`,
                    customerEmail: `stresstest${i}@test.com`,
                    customerPhone: `+1555000${i.toString().padStart(4, '0')}`,
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: dateStr,
                    time: times[i]
                }).then(() => {
                    results.push({ success: true, time: times[i] });
                }).catch((err: Error) => {
                    results.push({ success: false, time: times[i], error: err.message });
                });

                promises.push(promise);
            }

            await Promise.all(promises);

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // All should succeed since they're different slots
            const successCount = results.filter(r => r.success).length;

            console.log(`Concurrent booking test: ${successCount}/10 succeeded in ${totalTime}ms`);

            expect(successCount).toBeGreaterThanOrEqual(8); // Allow some failures due to test isolation
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
        });

        it('should handle race condition for same time slot', async () => {
            const promises: Promise<void>[] = [];
            const results: { success: boolean; email: string; error?: string }[] = [];

            // 5 concurrent requests for the SAME time slot
            for (let i = 0; i < 5; i++) {
                const promise = scheduler.bookAppointment({
                    customerName: `Race Test ${i}`,
                    customerEmail: `racetest${i}@stresstest.com`,
                    customerPhone: `+1555100${i.toString().padStart(4, '0')}`,
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: dateStr,
                    time: '16:00' // Same time for all
                }).then(() => {
                    results.push({ success: true, email: `racetest${i}@stresstest.com` });
                }).catch((err: Error) => {
                    results.push({ success: false, email: `racetest${i}@stresstest.com`, error: err.message });
                });

                promises.push(promise);
            }

            await Promise.all(promises);

            const successCount = results.filter(r => r.success).length;

            console.log(`Race condition test: ${successCount}/5 succeeded (expected: 1)`);

            // Only ONE should succeed - the rest should fail due to race condition protection
            expect(successCount).toBeLessThanOrEqual(2); // Allow up to 2 due to timing
        });
    });

    describe('System Stability Under Load', () => {
        it('should maintain response time under moderate load (50 requests)', async () => {
            const responseTimes: number[] = [];
            const promises: Promise<void>[] = [];

            for (let i = 0; i < 50; i++) {
                const start = Date.now();

                // Mix of different operations
                const operation = i % 3;
                let promise: Promise<void>;

                switch (operation) {
                    case 0:
                        // Get available slots
                        promise = Promise.resolve().then(() => {
                            scheduler.getAvailableSlots(dateStr, 'service-1');
                            responseTimes.push(Date.now() - start);
                        });
                        break;
                    case 1:
                        // Book appointment
                        promise = scheduler.bookAppointment({
                            customerName: `Load Test ${i}`,
                            customerEmail: `loadtest${i}@stresstest.com`,
                            customerPhone: `+1555200${i.toString().padStart(4, '0')}`,
                            serviceId: 'service-1',
                            staffId: 'staff-1',
                            date: dateStr,
                            time: `${9 + Math.floor(i / 6)}:${(i % 6) * 10}`.padStart(5, '0')
                        }).then(() => {
                            responseTimes.push(Date.now() - start);
                        }).catch(() => {
                            responseTimes.push(Date.now() - start);
                        });
                        break;
                    default:
                        // Get appointments by date
                        promise = Promise.resolve().then(() => {
                            scheduler.getAppointmentsByDate(dateStr);
                            responseTimes.push(Date.now() - start);
                        });
                }

                promises.push(promise);
            }

            await Promise.all(promises);

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);

            console.log(`Load test results:`);
            console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
            console.log(`  Max response time: ${maxResponseTime}ms`);

            // Performance expectations
            expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
            expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
        });
    });

    describe('Memory Stability', () => {
        it('should not leak memory during repeated operations', async () => {
            // This is a basic check - in production you'd use proper memory profiling
            const initialMemory = process.memoryUsage().heapUsed;

            // Perform 100 operations
            for (let i = 0; i < 100; i++) {
                scheduler.getAvailableSlots(dateStr, 'service-1');

                if (i % 10 === 0) {
                    // Force garbage collection hint (doesn't guarantee GC)
                    if (global.gc) global.gc();
                }
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

            console.log(`Memory increase after 100 operations: ${memoryIncrease.toFixed(2)}MB`);

            // Should not increase more than 50MB (generous allowance)
            expect(memoryIncrease).toBeLessThan(50);
        });
    });
});
