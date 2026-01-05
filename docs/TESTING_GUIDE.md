# Testing & Quality Assurance Guide

This document outlines the testing strategy and quality assurance processes for the AI Virtual Receptionist.

## Test Categories

### 1. Unit Tests (`npm run test:unit`)
Tests for individual functions and classes in isolation.

**Location:** `backend/tests/unit/`

| Test File | Coverage |
|-----------|----------|
| `validators.test.ts` | Input validation functions |
| `validation.test.ts` | Middleware validation |
| `scheduler.test.ts` | Appointment scheduling logic |
| `receptionist.test.ts` | AI receptionist service |
| `auth.test.ts` | Authentication utilities |

### 2. Integration Tests (`npm run test:integration`)
Tests for API endpoints and service interactions.

**Location:** `backend/tests/integration/`

| Test File | Coverage |
|-----------|----------|
| `booking.test.ts` | Appointment booking flow |
| `auth.test.ts` | Admin authentication |
| `callback.test.ts` | Callback request flow |
| `chat.test.ts` | Chat/conversation API |
| `appointmentStatus.test.ts` | Status update flows |

### 3. Stress Tests (`npm run test:stress`)
Tests for system behavior under load.

**Location:** `backend/tests/stress/`

| Test File | Coverage |
|-----------|----------|
| `booking.stress.test.ts` | Concurrent booking handling |

**Stress Test Scenarios:**
- 10 concurrent booking requests for different slots
- Race condition handling for same time slot
- 50 mixed operations under load
- Memory stability during repeated operations

### 4. Security Tests (`npm run test:security`)
Penetration testing and security validation.

**Location:** `backend/tests/security/`

| Test File | Coverage |
|-----------|----------|
| `penetration.test.ts` | Security vulnerability testing |
| `dataIsolation.test.ts` | Data access control testing |

**Security Test Categories:**

#### SQL Injection Protection
- Tests various SQL injection payloads in:
  - Customer name field
  - Email lookup
  - Search parameters

#### XSS Protection
- Tests various XSS payloads in:
  - Customer name
  - Notes field
  - URL parameters

#### Authentication Bypass
- Invalid JWT tokens
- Missing authorization headers
- Expired tokens

#### Input Validation Bypass
- Invalid email formats
- Invalid phone formats
- Oversized inputs

#### Path Traversal
- Directory traversal attempts
- Encoded path attacks

#### Header Injection
- CRLF injection attempts

### 5. Data Isolation Tests
Ensures proper data separation between users.

**Test Scenarios:**
- Customer A cannot see Customer B's appointments
- Session data isolation
- Admin vs public endpoint access
- Staff-specific data filtering
- Parameterized query validation

---

## Running Tests

### Run All Tests
```bash
npm run test:all
```

### Run Specific Category
```bash
npm run test:unit
npm run test:integration
npm run test:stress
npm run test:security
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

---

## Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000, // 60000 for stress tests
  verbose: true
};
```

### Test Setup (`tests/setup.ts`)
- Initializes test database
- Sets up mocks for external services
- Configures test environment variables

---

## Quality Metrics

### Target Coverage
| Area | Target |
|------|--------|
| Statements | > 70% |
| Branches | > 60% |
| Functions | > 70% |
| Lines | > 70% |

### Performance Expectations
| Metric | Target |
|--------|--------|
| Average response time | < 500ms |
| Max response time | < 5s |
| Concurrent requests | 50+ |
| Memory increase per 100 ops | < 50MB |

---

## Security Checklist

- [x] SQL Injection protection (parameterized queries)
- [x] XSS protection (input sanitization)
- [x] Authentication on admin endpoints
- [x] Input validation (email, phone, date, etc.)
- [x] Rate limiting on public endpoints
- [x] CORS configuration
- [x] JWT token validation
- [x] Data isolation between users
- [x] No sensitive data in error responses

---

## Continuous Integration

Tests should be run:
1. On every pull request
2. Before merging to main
3. On scheduled nightly builds (full suite)

### CI Pipeline Commands
```yaml
# Quick tests (PR)
npm run test:unit
npm run test:integration

# Full suite (nightly)
npm run test:all
```

---

## Adding New Tests

### Unit Test Template
```typescript
import { describe, it, expect } from '@jest/globals';
import { functionToTest } from '../../src/path/to/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should handle normal input', () => {
      expect(functionToTest('input')).toBe('expected');
    });

    it('should handle edge cases', () => {
      expect(functionToTest('')).toBe('');
    });
  });
});
```

### Integration Test Template
```typescript
import request from 'supertest';
import { createTestApp } from '../testApp';

describe('API Endpoint', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  it('should return 200 for valid request', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
});
```
