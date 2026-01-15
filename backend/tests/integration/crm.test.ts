import request from 'supertest';
import { createTestApp } from '../testApp';
import { sign } from 'jsonwebtoken';

const app = createTestApp();

// Create a valid token for testing
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const mockToken = sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

describe('CRM Integration', () => {
    describe('GET /api/admin/crm/contacts', () => {
        it('should return 401 without token', async () => {
            await request(app).get('/api/admin/crm/contacts').expect(401);
        });

        it('should return contacts with valid token', async () => {
            const response = await request(app)
                .get('/api/admin/crm/contacts')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('contacts');
            expect(response.body).toHaveProperty('total');
            // We assume seed data exists or DB is empty, both valid returns
            expect(Array.isArray(response.body.contacts)).toBe(true);
        });
    });

    describe('POST /api/admin/crm/sync', () => {
        it('should trigger sync successfully', async () => {
            const response = await request(app)
                .post('/api/admin/crm/sync')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Sync complete');
            expect(response.body).toHaveProperty('count');
        });
    });

    describe('Broadcast API', () => {
        it('should reject invalid segments', async () => {
            await request(app)
                .post('/api/admin/crm/broadcast')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ segment: 'invalid', subject: 'Hi', message: 'Test' })
                .expect(400);
        });

        it('should send broadcast to guests', async () => {
            const response = await request(app)
                .post('/api/admin/crm/broadcast')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ segment: 'guests', subject: 'Guest Test', message: 'Hello Guests' })
                .expect(200);

            expect(response.body).toHaveProperty('sent');
            expect(response.body).toHaveProperty('failed');
        });
    });
});
