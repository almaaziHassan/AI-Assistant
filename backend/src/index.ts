/**
 * AI Receptionist Server - Main Entry Point
 * 
 * This file has been refactored to use Dependency Injection.
 * All services are initialized here and injected into routes and handlers.
 * 
 * Complex logic has been extracted into dedicated modules:
 * - CORS config: src/config/cors.ts
 * - Socket handlers: src/socket/handlers.ts
 * - Session management: src/socket/sessionManager.ts
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Route factory imports
import chatRoutes from './routes/chat';
import { createAppointmentRouter } from './routes/appointments';
import { createServicesRouter } from './routes/services';
import { createAdminRouter } from './routes/admin';
import { createAdminRouterPrisma } from './routes/adminPrisma';
import { createCallbacksRouter } from './routes/callbacks';
import authRoutes from './routes/auth';

// Service imports
import { ReceptionistService } from './services/receptionist';
import { SchedulerService } from './services/scheduler';
import { emailService } from './services/email';
import { adminService } from './services/admin';
import { adminServicePrisma } from './services/adminPrisma';

// Core imports
import { initDatabase } from './db/database';
import { adminAuthMiddleware } from './middleware/adminAuth';
import { apiLimiter, chatLimiter, loginLimiter, bookingLimiter } from './middleware/rateLimiter';

// Configuration
import { getExpressCorsConfig, getSocketCorsConfig } from './config/cors';
import { createSocketHandlers } from './socket/handlers';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: getSocketCorsConfig() });
const PORT = process.env.PORT || 3000;

// ==================== Service Initialization ====================

// Initialize core services once
// These instances are shared across all routes and handlers
const receptionist = new ReceptionistService();
const scheduler = new SchedulerService();

console.log('✅ Services initialized with Dependency Injection');

// ==================== Middleware ====================

app.set('trust proxy', 1); // Trust Railway proxy for rate limiter
app.use(cors(getExpressCorsConfig()));
app.use(express.json());

// ==================== API Routes ====================

// Authentication routes
app.use('/api/auth/login', loginLimiter); // Protect login endpoint
app.use('/api/auth', authRoutes);

// Chat routes
app.use('/api/chat', chatLimiter, chatRoutes); // Protect expensive AI calls

// Appointment routes with injected dependencies
app.post('/api/appointments', bookingLimiter); // Rate limit bookings
app.use('/api/appointments', createAppointmentRouter(scheduler, emailService));

// Public routes with injected dependencies
app.use('/api/services', createServicesRouter(receptionist, adminService));

// Protected admin routes - using Prisma ORM (Enterprise upgrade)
// Old route: createAdminRouter(adminService, scheduler)
app.use('/api/admin', adminAuthMiddleware, createAdminRouterPrisma(adminServicePrisma));

// Callback routes
app.use('/api/callbacks', createCallbacksRouter());

// ==================== API Documentation ====================

app.get('/api', (req, res) => {
  res.json({
    name: 'AI Receptionist API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        verify: 'GET /api/auth/verify'
      },
      services: 'GET /api/services',
      appointments: {
        slots: 'GET /api/appointments/slots?date=YYYY-MM-DD&serviceId=xxx',
        book: 'POST /api/appointments',
        lookup: 'POST /api/appointments/lookup',
        get: 'GET /api/appointments/:id',
        cancel: 'DELETE /api/appointments/:id',
        reschedule: 'POST /api/appointments/:id/reschedule',
        stats: 'GET /api/appointments/stats',
        needingAction: 'GET /api/appointments/needing-action',
        updateStatus: 'PATCH /api/appointments/:id/status'
      },
      admin: {
        note: 'All admin routes require authentication (Bearer token)',
        dashboard: 'GET /api/admin/dashboard',
        appointments: 'GET /api/admin/appointments',
        staff: 'GET/POST/PUT/DELETE /api/admin/staff',
        locations: 'GET/POST/PUT/DELETE /api/admin/locations',
        holidays: 'GET/POST/PUT/DELETE /api/admin/holidays',
        waitlist: 'GET/POST/DELETE /api/admin/waitlist'
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== Socket.IO ====================

// Create socket handlers with injected receptionist service
const socketHandlers = createSocketHandlers(receptionist);
io.on('connection', socketHandlers.handleConnection);

console.log('✅ Socket handlers initialized with DI');

// ==================== Server Startup ====================

async function startServer() {
  try {
    // Initialize database
    await initDatabase();

    httpServer.listen(PORT, () => {
      console.log(`AI Receptionist server running on port ${PORT}`);
      console.log(`REST API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
      console.log('✅ All routes and handlers using Dependency Injection');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };
