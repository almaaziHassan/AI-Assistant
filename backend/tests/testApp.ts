/**
 * Test App Setup
 * Creates an Express app for integration testing
 */

import express from 'express';
import cors from 'cors';
import appointmentsRouter from '../src/routes/appointmentsPrisma';
import servicesRouter from '../src/routes/servicesPrisma';
import callbacksRouter from '../src/routes/callbacksPrisma';
import crmRouter from '../src/routes/crm';
import adminRouter from '../src/routes/adminPrisma';
import chatRouter from '../src/routes/chat';
import authRoutes from '../src/routes/auth';

import { adminAuthMiddleware } from '../src/middleware/adminAuth';

export function createTestApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/callbacks', callbacksRouter);
  app.use('/api/admin/crm', adminAuthMiddleware, crmRouter);
  app.use('/api/admin', adminAuthMiddleware, adminRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/auth', authRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
