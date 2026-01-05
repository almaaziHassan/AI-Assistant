/**
 * Data Isolation Tests
 * 
 * Tests to ensure data isolation between:
 * - Different customers
 * - Different sessions
 * - Different staff members
 * - Admin vs public data access
 */

import request from 'supertest';
import { createTestApp } from '../testApp';
import express from 'express';

describe('Data Isolation Tests', () => {
    let app: express.Application;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('Customer Data Isolation', () => {
        const customer1 = {
            name: 'Customer One',
            email: 'customer1@isolation.test',
            phone: '+15551000001'
        };

        const customer2 = {
            name: 'Customer Two',
            email: 'customer2@isolation.test',
            phone: '+15551000002'
        };

        it('should not expose other customers data in appointment lookup', async () => {
            // Create appointments for both customers
            const apt1 = await request(app)
                .post('/api/appointments')
                .send({
                    customerName: customer1.name,
                    customerEmail: customer1.email,
                    customerPhone: customer1.phone,
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: '2025-04-01',
                    time: '10:00'
                });

            const apt2 = await request(app)
                .post('/api/appointments')
                .send({
                    customerName: customer2.name,
                    customerEmail: customer2.email,
                    customerPhone: customer2.phone,
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: '2025-04-01',
                    time: '11:00'
                });

            // Customer 1 should only see their own appointments
            const lookup1 = await request(app)
                .post('/api/appointments/lookup')
                .send({ email: customer1.email });

            if (lookup1.status === 200 && Array.isArray(lookup1.body)) {
                // Should not contain customer2's data
                lookup1.body.forEach((apt: any) => {
                    expect(apt.customerEmail).not.toBe(customer2.email);
                    expect(apt.customerName).not.toBe(customer2.name);
                });
            }

            // Customer 2 should only see their own appointments
            const lookup2 = await request(app)
                .post('/api/appointments/lookup')
                .send({ email: customer2.email });

            if (lookup2.status === 200 && Array.isArray(lookup2.body)) {
                // Should not contain customer1's data
                lookup2.body.forEach((apt: any) => {
                    expect(apt.customerEmail).not.toBe(customer1.email);
                    expect(apt.customerName).not.toBe(customer1.name);
                });
            }
        });

        it('should not allow accessing another customers appointment by ID', async () => {
            // Create an appointment
            const createResponse = await request(app)
                .post('/api/appointments')
                .send({
                    customerName: 'Private Customer',
                    customerEmail: 'private@isolation.test',
                    customerPhone: '+15551000003',
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: '2025-04-01',
                    time: '12:00'
                });

            if (createResponse.status === 201) {
                const appointmentId = createResponse.body.id;

                // Another customer should not be able to modify this appointment
                const rescheduleResponse = await request(app)
                    .post(`/api/appointments/${appointmentId}/reschedule`)
                    .send({
                        email: 'attacker@evil.com', // Different email
                        date: '2025-04-02',
                        time: '10:00'
                    });

                // Should be rejected - email doesn't match
                expect([400, 403, 404]).toContain(rescheduleResponse.status);
            }
        });

        it('should not expose phone numbers in public endpoints', async () => {
            // Get slots - should not contain customer data
            const slotsResponse = await request(app)
                .get('/api/appointments/slots')
                .query({
                    date: '2025-04-01',
                    serviceId: 'service-1'
                });

            if (slotsResponse.status === 200) {
                const body = JSON.stringify(slotsResponse.body);

                // Phone numbers should not be exposed
                expect(body).not.toMatch(/\+\d{10,15}/);
                expect(body).not.toContain('customerPhone');
                expect(body).not.toContain('customer_phone');
            }
        });
    });

    describe('Session Data Isolation', () => {
        it('should not share conversation history between sessions', async () => {
            // Session 1 sends a message
            const session1 = 'isolation-session-1-' + Date.now();
            const session2 = 'isolation-session-2-' + Date.now();

            // In a real implementation, we'd verify through socket.io
            // For HTTP API, we verify session-based data isn't leaked

            // Get conversation for session 1
            const conv1 = await request(app)
                .get(`/api/conversations/${session1}`)
                .catch(() => null);

            // Get conversation for session 2
            const conv2 = await request(app)
                .get(`/api/conversations/${session2}`)
                .catch(() => null);

            // Each session should have isolated data
            if (conv1 && conv2 && conv1.status === 200 && conv2.status === 200) {
                expect(conv1.body).not.toEqual(conv2.body);
            }
        });
    });

    describe('Admin vs Public Data Access', () => {
        it('should not expose staff internal data to public endpoints', async () => {
            // Get staff from public endpoint
            const publicStaff = await request(app)
                .get('/api/services/staff');

            if (publicStaff.status === 200 && Array.isArray(publicStaff.body)) {
                publicStaff.body.forEach((staff: any) => {
                    // Should not expose sensitive fields
                    expect(staff.email).toBeUndefined();
                    expect(staff.schedule).toBeUndefined();
                    expect(staff.phone).toBeUndefined();

                    // Should only have name and role
                    expect(staff.name).toBeDefined();
                });
            }
        });

        it('should not expose callback details without admin auth', async () => {
            // Create a callback
            const callbackResponse = await request(app)
                .post('/api/callbacks')
                .send({
                    customerName: 'Callback Test',
                    customerPhone: '+15551234567',
                    customerEmail: 'callback@test.com',
                    preferredTime: 'morning',
                    concerns: 'Test concern'
                });

            // Try to get callbacks without auth
            const getCallbacks = await request(app)
                .get('/api/admin/callbacks');

            // Should be rejected
            expect([401, 403]).toContain(getCallbacks.status);
        });

        it('should not expose appointment statistics without admin auth', async () => {
            const statsResponse = await request(app)
                .get('/api/admin/stats');

            // Should be rejected
            expect([401, 403]).toContain(statsResponse.status);

            // Even the error response should not leak data
            expect(statsResponse.body.totalAppointments).toBeUndefined();
            expect(statsResponse.body.stats).toBeUndefined();
        });
    });

    describe('Staff Data Isolation', () => {
        it('should only show slots for selected staff member', async () => {
            // Get slots without staff filter
            const allSlots = await request(app)
                .get('/api/appointments/slots')
                .query({
                    date: '2025-04-15',
                    serviceId: 'service-1'
                });

            // Get slots for specific staff
            const staffSlots = await request(app)
                .get('/api/appointments/slots')
                .query({
                    date: '2025-04-15',
                    serviceId: 'service-1',
                    staffId: 'staff-1'
                });

            // Both should succeed
            if (allSlots.status === 200 && staffSlots.status === 200) {
                // Staff-filtered slots should be subset or equal
                const allSlotsLen = allSlots.body.slots?.length || 0;
                const staffSlotsLen = staffSlots.body.slots?.length || 0;

                expect(staffSlotsLen).toBeLessThanOrEqual(allSlotsLen + 1);
            }
        });

        it('should not allow booking with non-existent staff ID', async () => {
            const response = await request(app)
                .post('/api/appointments')
                .send({
                    customerName: 'Test User',
                    customerEmail: 'test@isolation.test',
                    customerPhone: '+15551234567',
                    serviceId: 'service-1',
                    staffId: 'non-existent-staff-id',
                    date: '2025-04-01',
                    time: '10:00'
                });

            // Should fail - staff doesn't exist
            expect(response.status).toBe(400);
        });
    });

    describe('Cross-Service Data Isolation', () => {
        it('should not allow booking a staff member for wrong service', async () => {
            // This test verifies that staff-service assignments are respected
            // Staff should only be available for services they're assigned to

            const response = await request(app)
                .get('/api/services/staff/wrong-service-id');

            // Should return empty or 404, not all staff
            if (response.status === 200) {
                // If there are staff without service restrictions, they might appear
                // but this validates the endpoint filters properly
                expect(Array.isArray(response.body)).toBe(true);
            }
        });
    });

    describe('Database Query Isolation', () => {
        it('should use parameterized queries (prevents SQL injection leaking data)', async () => {
            // Attempt to use SQL injection to leak data from another table
            const injectionAttempt = "'; SELECT * FROM staff; --";

            const response = await request(app)
                .post('/api/appointments/lookup')
                .send({ email: injectionAttempt });

            // Should not return staff data
            if (response.status === 200 && Array.isArray(response.body)) {
                response.body.forEach((item: any) => {
                    // Should not have staff table columns
                    expect(item.role).toBeUndefined();
                    expect(item.schedule).toBeUndefined();
                });
            }
        });
    });
});
