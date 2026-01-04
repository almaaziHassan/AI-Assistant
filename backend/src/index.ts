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

import chatRoutes from './routes/chat';
import { createAppointmentRouter } from './routes/appointments';
import { createAppointmentRouterPrisma } from './routes/appointmentsPrisma';
import { createServicesRouter } from './routes/services';
import { createAdminRouter } from './routes/admin';
import { createAdminRouterPrisma } from './routes/adminPrisma';
import { createCallbacksRouter } from './routes/callbacks';
import { createCallbacksRouterPrisma } from './routes/callbacksPrisma';
import { createServicesRouterPrisma } from './routes/servicesPrisma';
import authRoutes from './routes/auth';

// Service imports
import { ReceptionistService } from './services/receptionist';
import { SchedulerService } from './services/scheduler';
import { schedulerServicePrisma } from './services/schedulerPrisma';
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

// Appointment routes - using Prisma ORM
app.post('/api/appointments', bookingLimiter); // Rate limit bookings
app.use('/api/appointments', createAppointmentRouterPrisma(schedulerServicePrisma, emailService));

// Public routes - using Prisma ORM
app.use('/api/services', createServicesRouterPrisma(receptionist, adminServicePrisma));

// Protected admin routes - using Prisma ORM (Enterprise upgrade)
// Old route: createAdminRouter(adminService, scheduler)
app.use('/api/admin', adminAuthMiddleware, createAdminRouterPrisma(adminServicePrisma));

// Callback routes - using Prisma ORM
app.use('/api/callbacks', createCallbacksRouterPrisma());

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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      node_env: process.env.NODE_ENV,
      has_db_url: !!process.env.DATABASE_URL,
      has_direct_url: !!process.env.DIRECT_URL,
      db_url_starts_with: process.env.DATABASE_URL?.substring(0, 10),
      // Do NOT expose full secrets
      prisma_version: '6.x'
    }
  });
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
