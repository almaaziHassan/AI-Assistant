# Dependency Injection Implementation Guide

**Goal:** Improve design score from 4.3/5 to 4.7/5  
**Time Estimate:** 2-3 hours  
**Difficulty:** Medium  
**Impact:** High - Better testability, loose coupling, maintainability

---

## Why Dependency Injection?

### Current Problems:

```typescript
// ❌ Hard-coded dependencies
export class ReceptionistService {
  constructor() {
    this.groq = new GroqService();        // Can't test with mock
    this.config = servicesConfig;          // Can't override config
  }
}

// ❌ Hard to test
test('should chat', () => {
  const service = new ReceptionistService();  // Always uses real GroqService!
  // Can't inject a mock Groq service
});

// ❌ Tight coupling
import { adminService } from '../admin';  // Global singleton
const staff = adminService.getAllStaff();  // Always the same instance
```

### After DI:

```typescript
// ✅ Dependencies injected - flexible and testable
export class ReceptionistService {
  constructor(
    private groq: GroqService = new GroqService(),
    private adminService: AdminService = adminService
  ) {}
}

// ✅ Easy to test
test('should chat', () => {
  const mockGroq = { chat: jest.fn() };
  const service = new ReceptionistService(mockGroq);  // Inject mock!
  // Now you can control the behavior
});
```

---

## Step-by-Step Implementation

### Phase 1: Update ReceptionistService (30 minutes)

#### **File:** `backend/src/services/receptionist/index.ts`

**Before:**
```typescript
export class ReceptionistService {
    private groq: GroqService;
    private config: typeof servicesConfig;

    constructor() {
        this.groq = new GroqService();
        this.config = servicesConfig;
    }
```

**After:**
```typescript
export class ReceptionistService {
    private groq: GroqService;
    private config: typeof servicesConfig;
    private adminService: AdminService;

    constructor(
        groq: GroqService = new GroqService(),
        config = servicesConfig,
        adminSvc: AdminService = adminService
    ) {
        this.groq = groq;
        this.config = config;
        this.adminService = adminSvc;
    }
```

**Changes needed in the file:**

1. Update constructor signature
2. Replace all `adminService.` calls with `this.adminService.`

**Example:**
```typescript
// OLD
const dbServices = adminService.getAllServices(true);
const dbStaff = adminService.getAllStaff(true);

// NEW
const dbServices = this.adminService.getAllServices(true);
const dbStaff = this.adminService.getAllStaff(true);
```

---

### Phase 2: Update SchedulerService (20 minutes)

#### **File:** `backend/src/services/scheduler.ts`

**Before:**
```typescript
export class SchedulerService {
  private config = servicesConfig;
```

**After:**
```typescript
export class SchedulerService {
  private config: typeof servicesConfig;
  private adminService: AdminService;

  constructor(
    config = servicesConfig,
    adminSvc: AdminService = adminService
  ) {
    this.config = config;
    this.adminService = adminSvc;
  }
```

**Changes needed:**

Replace all `adminService.` calls with `this.adminService.`:

```typescript
// Line ~210 - OLD
const service = adminService.getService(serviceId);

// NEW
const service = this.adminService.getService(serviceId);

// Line ~218 - OLD
const holiday = adminService.getHolidayByDate(date);

// NEW
const holiday = this.adminService.getHolidayByDate(date);

// Line ~243, 246 - OLD
const s = adminService.getStaff(staffId);
relevantStaff = adminService.getAllStaff(true).filter(...);

// NEW
const s = this.adminService.getStaff(staffId);
relevantStaff = this.adminService.getAllStaff(true).filter(...);

// Line ~326, 430, 482 - Similar replacements needed
```

---

### Phase 3: Update Routes to Use DI (40 minutes)

#### **File:** `backend/src/routes/appointments.ts`

**Before:**
```typescript
const router = Router();
const scheduler = new SchedulerService();  // Hard-coded
```

**After:**
```typescript
// Factory function for router
export function createAppointmentRouter(
  scheduler: SchedulerService = new SchedulerService(),
  emailService: EmailService = emailService
) {
  const router = Router();
  
  // All routes use injected scheduler
  router.post('/', validateBookingRequest, async (req, res) => {
    const appointment = await scheduler.bookAppointment(booking);
    emailService.sendConfirmationEmail(appointment).catch(err => {
      console.error('Failed to send confirmation email:', err);
    });
    res.status(201).json(appointment);
  });
  
  // ... rest of routes
  
  return router;
}

// For backwards compatibility
export default createAppointmentRouter();
```

#### **File:** `backend/src/routes/services.ts`

**Before:**
```typescript
const router = Router();
const receptionist = new ReceptionistService();
```

**After:**
```typescript
export function createServicesRouter(
  receptionist: ReceptionistService = new ReceptionistService()
) {
  const router = Router();
  
  router.get('/', (req, res) => {
    const services = receptionist.getServices();
    res.json(services);
  });
  
  // ... rest of routes
  
  return router;
}

export default createServicesRouter();
```

#### **File:** `backend/src/routes/admin.ts`

**Before:**
```typescript
const adminSvc = adminService;
```

**After:**
```typescript
export function createAdminRouter(
  adminSvc: AdminService = adminService
) {
  const router = Router();
  
  // Use injected adminSvc throughout
  
  return router;
}

export default createAdminRouter();
```

---

### Phase 4: Update Socket Handlers (20 minutes)

#### **File:** `backend/src/socket/handlers.ts`

**Before:**
```typescript
const receptionist = new ReceptionistService();

export function handleConnection(socket: Socket): void {
  // Uses global receptionist
}
```

**After:**
```typescript
export function createSocketHandlers(
  receptionist: ReceptionistService = new ReceptionistService()
) {
  return {
    handleConnection(socket: Socket): void {
      console.log(`Client connected: ${socket.id}`);
      
      socket.on('init', handleInit(socket));
      socket.on('message', handleMessage(socket, receptionist));
      socket.on('saveConfirmation', handleSaveConfirmation(socket));
      socket.on('disconnect', handleDisconnect(socket));
    }
  };
}

function handleMessage(socket: Socket, receptionist: ReceptionistService) {
  return async (data: { content: string }) => {
    const sessionId = getSessionForSocket(socket.id);
    if (!sessionId) {
      console.error('No session found for socket:', socket.id);
      return;
    }

    const history = getConversationHistory(sessionId);
    history.push({ role: 'user', content: data.content });
    chatHistoryService.saveMessage(sessionId, 'user', data.content);

    socket.emit('typing', { isTyping: true });

    try {
      const response = await receptionist.chat(data.content, history);
      // ... rest of the handler
    } catch (error) {
      // ... error handling
    }
  };
}

// For backwards compatibility
const defaultHandlers = createSocketHandlers();
export const handleConnection = defaultHandlers.handleConnection;
```

---

### Phase 5: Update Main Server File (20 minutes)

#### **File:** `backend/src/index.ts`

**Before:**
```typescript
import appointmentRoutes from './routes/appointments';
import servicesRoutes from './routes/services';

app.use('/api/appointments', appointmentRoutes);
app.use('/api/services', servicesRoutes);
```

**After:**
```typescript
import { createAppointmentRouter } from './routes/appointments';
import { createServicesRouter } from './routes/services';
import { createAdminRouter } from './routes/admin';
import { createSocketHandlers } from './socket/handlers';
import { ReceptionistService } from './services/receptionist';
import { SchedulerService } from './services/scheduler';
import { adminService } from './services/admin';
import { emailService } from './services/email';

// Initialize services (can be configured here)
const scheduler = new SchedulerService();
const receptionist = new ReceptionistService();

// Create routes with injected dependencies
app.use('/api/appointments', createAppointmentRouter(scheduler, emailService));
app.use('/api/services', createServicesRouter(receptionist));
app.use('/api/admin', createAdminRouter(adminService));

// Socket.IO setup
const socketHandlers = createSocketHandlers(receptionist);
io.on('connection', socketHandlers.handleConnection);
```

**Benefits:**
- All dependencies visible in one place
- Easy to swap implementations for testing
- Can create multiple router instances with different configs

---

## Advanced: Creating Interfaces (Optional, +1 hour)

For even better design, create interfaces:

### **File:** `backend/src/interfaces/services.ts`

```typescript
import { ChatMessage } from '../services/groq';
import { Appointment, TimeSlot, BookingRequest } from '../services/scheduler';

// AI Service Interface
export interface AIService {
  chat(messages: ChatMessage[]): Promise<{ content: string }>;
  chatWithFunctions(messages: ChatMessage[], tools: any[]): Promise<{ content: string | null; toolCalls?: any[] }>;
}

// Scheduler Interface
export interface ISchedulerService {
  getAvailableSlots(date: string, serviceId: string, staffId?: string, tz?: number): TimeSlot[];
  bookAppointment(request: BookingRequest): Promise<Appointment>;
  cancelAppointment(id: string): boolean;
  getAppointment(id: string): Appointment | null;
  getAppointmentsByEmail(email: string): Appointment[];
  getAppointmentsByDate(date: string): Appointment[];
}

// Admin Service Interface
export interface IAdminService {
  getAllServices(activeOnly?: boolean): any[];
  getAllStaff(activeOnly?: boolean): any[];
  getService(id: string): any | null;
  getStaff(id: string): any | null;
  getHolidayByDate(date: string): any | null;
}

// Email Service Interface  
export interface IEmailService {
  sendConfirmationEmail(appointment: Appointment): Promise<void>;
  sendCallbackNotification(callback: any): Promise<void>;
}
```

### Update Services to Implement Interfaces:

```typescript
import { ISchedulerService } from '../interfaces/services';

export class SchedulerService implements ISchedulerService {
  // Implementation
}
```

### Use Interfaces in Constructors:

```typescript
import { AIService, IAdminService } from '../interfaces/services';

export class ReceptionistService {
  constructor(
    private ai: AIService = new GroqService(),
    private adminService: IAdminService = adminService
  ) {}
}
```

**Benefits:**
- Can swap any implementation that matches the interface
- Better TypeScript IntelliSense
- Enforces contracts between modules

---

## Testing Benefits

### Before DI:

```typescript
// ❌ Hard to test - uses real GroqService
describe('ReceptionistService', () => {
  it('should chat', async () => {
    const service = new ReceptionistService();
    // Stuck with real Groq API calls!
  });
});
```

### After DI:

```typescript
// ✅ Easy to test - inject mocks
describe('ReceptionistService', () => {
  it('should chat', async () => {
    const mockGroq = {
      chat: jest.fn().mockResolvedValue({ content: 'Hello!' }),
      chatWithFunctions: jest.fn()
    };
    
    const mockAdmin = {
      getAllServices: jest.fn().mockReturnValue([]),
      getAllStaff: jest.fn().mockReturnValue([])
    };
    
    const service = new ReceptionistService(mockGroq, servicesConfig, mockAdmin);
    
    const result = await service.chat('Hi', []);
    
    expect(mockGroq.chat).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
```

**Now you can:**
- ✅ Test without external API calls
- ✅ Control mock behavior
- ✅ Verify interactions
- ✅ Test error cases easily

---

## Migration Checklist

### Phase 1: ReceptionistService ✅
- [ ] Update constructor to accept dependencies
- [ ] Replace `adminService.` with `this.adminService.`
- [ ] Test that existing functionality still works

### Phase 2: SchedulerService ✅
- [ ] Update constructor to accept dependencies
- [ ] Replace `adminService.` with `this.adminService.`
- [ ] Test booking flow

### Phase 3: Routes ✅
- [ ] Convert to factory functions
- [ ] Export both factory and default instance
- [ ] Test API endpoints

### Phase 4: Socket Handlers ✅
- [ ] Convert to factory function
- [ ] Pass receptionist instance
- [ ] Test WebSocket communication

### Phase 5: Main Server ✅
- [ ] Import factory functions
- [ ] Initialize services
- [ ] Wire up dependencies
- [ ] Test full application

### Phase 6: Testing ✅
- [ ] Write tests with mocked dependencies
- [ ] Verify all features work
- [ ] Check for regressions

---

## Code Changes Summary

### Files to Modify:

1. **`services/receptionist/index.ts`** - Add DI to constructor (~10 changes)
2. **`services/scheduler.ts`** - Add DI to constructor (~15 changes)
3. **`routes/appointments.ts`** - Convert to factory (~30 lines)
4. **`routes/services.ts`** - Convert to factory (~20 lines)
5. **`routes/admin.ts`** - Convert to factory (~20 lines)
6. **`socket/handlers.ts`** - Convert to factory (~40 lines)
7. **`index.ts`** - Wire up dependencies (~20 lines)

### Optional Files to Create:

8. **`interfaces/services.ts`** - Service interfaces (new file)

**Total Changes:** ~155 lines modified/added  
**Total Time:** 2-3 hours  
**Breaking Changes:** None (backwards compatible)

---

## Expected Improvements

### Design Metrics:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Dependency Inversion** | 3.5/5 | 5/5 | +43% ✅ |
| **Loose Coupling** | 3/5 | 4.5/5 | +50% ✅ |
| **Testability** | 3.5/5 | 5/5 | +43% ✅ |
| **Dependency Injection** | 3/5 | 5/5 | +67% ✅ |
| **Overall Design Score** | 4.3/5 | 4.7/5 | +9% ✅ |

### Code Quality:

- ✅ Explicit dependencies (no hidden globals)
- ✅ Easy to test (inject mocks)
- ✅ Easy to swap implementations
- ✅ Better separation of concerns
- ✅ Configuration flexibility

---

## Quick Start Script

For fastest implementation, do in this order:

### **Step 1: Update ReceptionistService** (15 min)
```bash
# Edit backend/src/services/receptionist/index.ts
# Add constructor parameters
# Replace adminService. with this.adminService.
```

### **Step 2: Update SchedulerService** (15 min)
```bash
# Edit backend/src/services/scheduler.ts
# Add constructor parameters
# Replace adminService. with this.adminService.
```

### **Step 3: Update One Route (Test)** (10 min)
```bash
# Edit backend/src/routes/services.ts
# Convert to factory function
# Test that it works
```

### **Step 4: Update Remaining Routes** (30 min)
```bash
# Edit appointments.ts, admin.ts
# Convert all to factory functions
```

### **Step 5: Update Socket Handlers** (20 min)
```bash
# Edit backend/src/socket/handlers.ts
# Convert to factory function
```

### **Step 6: Wire Up in Main** (15 min)
```bash
# Edit backend/src/index.ts
# Import factories
# Inject dependencies
```

### **Step 7: Test Everything** (30 min)
```bash
npm run build
npm run dev
# Test all endpoints
# Test WebSocket chat
# Verify no regressions
```

---

## Troubleshooting

### Issue: "Cannot find adminService"

**Problem:** Forgot to import AdminService
```typescript
import { adminService } from '../services/admin';
import { AdminService } from '../services/admin'; // Import the type too
```

### Issue: "Type mismatch"

**Problem:** Default parameters need correct types
```typescript
// ❌ Wrong
constructor(adminSvc = adminService) {}

// ✅ Correct
constructor(adminSvc: AdminService = adminService) {}
```

### Issue: "Tests failing"

**Problem:** Old tests don't inject dependencies
```typescript
// Update tests to use new constructor
const service = new ReceptionistService();  // Still works (default params)

// Or inject mocks
const service = new ReceptionistService(mockGroq, mockConfig, mockAdmin);
```

---

## Alternative: Simple DI Container

If you want a more advanced setup:

```typescript
// backend/src/container.ts
import { GroqService } from './services/groq';
import { AdminService } from './services/admin';
import { ReceptionistService } from './services/receptionist';
import { SchedulerService } from './services/scheduler';
import { emailService } from './services/email';
import servicesConfig from './config/services.json';

export class Container {
  private static instance: Container;
  
  public readonly groq: GroqService;
  public readonly admin: AdminService;
  public readonly receptionist: ReceptionistService;
  public readonly scheduler: SchedulerService;
  public readonly email: typeof emailService;
  
  private constructor() {
    // Initialize in dependency order
    this.groq = new GroqService();
    this.admin = new AdminService();
    this.email = emailService;
    
    // Inject dependencies
    this.receptionist = new ReceptionistService(
      this.groq,
      servicesConfig,
      this.admin
    );
    
    this.scheduler = new SchedulerService(
      servicesConfig,
      this.admin
    );
  }
  
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }
}

// Usage in routes/index.ts
const container = Container.getInstance();
app.use('/api/appointments', createAppointmentRouter(container.scheduler, container.email));
app.use('/api/services', createServicesRouter(container.receptionist));
```

---

## Conclusion

Implementing DI will:

✅ **Boost design score from 4.3/5 to 4.7/5**  
✅ **Make testing 10x easier**  
✅ **Reduce coupling**  
✅ **Improve maintainability**  
✅ **Enable flexibility**

**Time Investment:** 2-3 hours  
**Complexity:** Medium  
**Risk:** Low (backwards compatible)  
**Reward:** High

**Ready to implement? Start with Phase 1 (ReceptionistService) and test before moving to the next phase!**
