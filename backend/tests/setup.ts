// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment  
process.env.NODE_ENV = 'test';

// Increase timeout for async operations
jest.setTimeout(30000);

// Note: Database initialization is done per-test-suite as needed.
// Unit tests mock the database, integration tests use real database.
// This setup file only configures the test environment.
