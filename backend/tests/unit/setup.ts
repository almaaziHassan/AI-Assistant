// Unit Test Setup File
// This setup is for unit tests only - no real database initialization
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock the database for unit tests - they should not use real DB
jest.mock('../src/db/database', () => ({
    initDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn(),
    runQuery: jest.fn(),
    getOne: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    getDatabaseMode: jest.fn().mockReturnValue('sqlite'),
    runQueryAsync: jest.fn(),
    getOneAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([])
}));

// Mock seedDatabase 
jest.mock('../src/utils/seedDatabase', () => ({
    seedDatabase: jest.fn().mockResolvedValue(undefined)
}));
