// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment  
process.env.NODE_ENV = 'test';

// Force SQLite for integration tests
// set to non-empty string to prevent dotenv from reloading logic
// Force SQLite for integration tests
// set to non-empty string to prevent dotenv from reloading logic
process.env.DATABASE_URL = 'sqlite://memory';

// Mock the Prisma singleton globally
jest.mock('../src/db/prisma');

// Mock Knowledge Service to avoid loading heavy ML models
const mockKnowledgeServiceInstance = {
    initialize: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
    addDocument: jest.fn(),
    generateEmbedding: jest.fn().mockResolvedValue(new Array(384).fill(0.1))
};

jest.mock('../src/services/knowledge', () => ({
    knowledgeService: mockKnowledgeServiceInstance,
    KnowledgeService: {
        getInstance: jest.fn(() => mockKnowledgeServiceInstance)
    }
}));

// Increase timeout for async operations
jest.setTimeout(30000);

// Database initialization for integration tests
let dbInitialized = false;

beforeAll(async () => {
    // Check if this is a unit test (they mock the database)
    const testPath = expect.getState().testPath || '';
    const isUnitTest = testPath.includes('/unit/') || testPath.includes('\\unit\\');

    if (!isUnitTest) {
        try {
            // Dynamic import to avoid issues with unit tests
            const { initDatabase } = await import('../src/db/database');
            await initDatabase();
            dbInitialized = true;
            console.log('Database initialized for integration tests');

            // Seed Mock Prisma for tests
            // Since tests use AdminServicePrisma which uses Prisma, and Prisma is mocked,
            // we must populate the mock store. The original seedDatabase writes to sql.js/pg.
            const prisma = (await import('../src/db/prisma')).default;

            // Seed Services
            const services = await prisma.service.findMany();
            if (services.length === 0) {
                await prisma.service.create({
                    data: {
                        id: 'consultation',
                        name: 'General Consultation',
                        description: 'Initial discussion',
                        duration: 30,
                        price: 50.00,
                        isActive: true,
                        displayOrder: 1
                    }
                });
                await prisma.service.create({
                    data: {
                        id: 'massage',
                        name: 'Deep Tissue Massage',
                        description: 'Therapeutic massage',
                        duration: 60,
                        price: 100.00,
                        isActive: true,
                        displayOrder: 2
                    }
                });
            }

            // Seed Staff
            const staff = await prisma.staff.findMany();
            if (staff.length === 0) {
                await prisma.staff.create({
                    data: {
                        id: 'staff-1',
                        name: 'Dr. Sarah Smith',
                        email: 'sarah@example.com',
                        role: 'Therapist',
                        isActive: true,
                        // In mock, simplistic handling of relations might be needed depending on implementation
                        // But the mock create just pushes data.
                        services: ['consultation', 'massage']
                    }
                });
            }

            console.log('Mock Prisma seeded for integration tests');

        } catch (error) {
            console.warn('Database/Prisma initialization failed:', (error as Error).message);
        }
    }
});

afterAll(async () => {
    if (dbInitialized) {
        try {
            const { closeDatabase } = await import('../src/db/database');
            closeDatabase();
            console.log('Database closed');
        } catch {
            // Ignore cleanup errors
        }
    }
});
