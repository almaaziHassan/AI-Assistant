/**
 * Test App Setup
 * Creates an Express app for integration testing
 */

import express from 'express';
import cors from 'cors';
import appointmentsRouter from '../src/routes/appointments';
import servicesRouter from '../src/routes/services';
import callbacksRouter from '../src/routes/callbacks';
import adminRouter from '../src/routes/admin';
import chatRouter from '../src/routes/chat';

export function createTestApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/callbacks', callbacksRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/chat', chatRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
