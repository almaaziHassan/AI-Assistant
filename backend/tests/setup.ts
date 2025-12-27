// Test setup file
import dotenv from 'dotenv';
import { initDatabase, closeDatabase } from '../src/db/database';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console.log/error in tests to reduce noise
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// };

// Increase timeout for async operations
jest.setTimeout(30000);

// Initialize database before all tests
beforeAll(async () => {
  await initDatabase();
});

// Clean up after all tests
afterAll(async () => {
  closeDatabase();
});
