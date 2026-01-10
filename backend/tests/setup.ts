// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment  
process.env.NODE_ENV = 'test';

// Force SQLite for integration tests
// set to non-empty string to prevent dotenv from reloading logic
process.env.DATABASE_URL = 'sqlite://memory';

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
        } catch (error) {
            console.warn('Database initialization failed:', (error as Error).message);
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
