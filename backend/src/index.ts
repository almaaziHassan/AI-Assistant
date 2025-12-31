import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import chatRoutes from './routes/chat';
import appointmentsRoutes from './routes/appointments';
import servicesRoutes from './routes/services';
import adminRoutes from './routes/admin';
import callbacksRoutes from './routes/callbacks';
import authRoutes from './routes/auth';
import { initDatabase } from './db/database';
import { ReceptionistService } from './services/receptionist';
import { chatHistoryService } from './services/chatHistory';
import { adminAuthMiddleware } from './middleware/adminAuth';
import { apiLimiter, chatLimiter, loginLimiter, bookingLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1); // Trust Railway proxy for rate limiter
app.use(cors());
app.use(express.json());

// Initialize receptionist service
const receptionist = new ReceptionistService();

// REST API routes with rate limiting
app.use('/api/auth/login', loginLimiter); // Protect login endpoint
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes); // Protect expensive AI calls
// Appointments: only rate limit POST (actual bookings), GET endpoints are free
app.post('/api/appointments', bookingLimiter);
app.use('/api/appointments', appointmentsRoutes); // No rate limit on GET (slots, stats)
app.use('/api/services', servicesRoutes); // No rate limit - public info
app.use('/api/admin', adminAuthMiddleware, adminRoutes); // Protected with auth
// Callbacks: POST is public (for users to submit), other methods are admin-only
// We handle this by mounting the router without auth, but the router's GET/PUT/DELETE are protected by checking auth
app.use('/api/callbacks', callbacksRoutes);

// API index
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

// Socket.IO for real-time chat
interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}

// Map socket IDs to session IDs
const socketSessions = new Map<string, string>();
const conversations = new Map<string, ConversationHistory[]>();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle session initialization
  socket.on('init', (data: { sessionId?: string }) => {
    let sessionId = data.sessionId;
    let isNewSession = false;

    // Create new session if none provided or invalid
    if (!sessionId || !chatHistoryService.sessionExists(sessionId)) {
      sessionId = chatHistoryService.createSession();
      isNewSession = true;
    }

    // Map socket to session
    socketSessions.set(socket.id, sessionId);

    // Load existing history from database (simple format for AI context)
    const savedHistory = chatHistoryService.getRecentHistory(sessionId);
    conversations.set(sessionId, savedHistory);

    // Load full history (with message types and action data) for frontend
    const fullHistory = chatHistoryService.getFullHistory(sessionId);

    // Send session ID to client
    socket.emit('session', { sessionId });

    // Send chat history to client with full message data
    if (fullHistory.length > 0) {
      socket.emit('history', {
        messages: fullHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
          messageType: msg.messageType || 'text',
          actionType: msg.actionType,
          actionData: msg.actionData
        }))
      });
    }

    // Send welcome message only for new sessions
    if (isNewSession) {
      const config = receptionist.getConfig();
      const greeting = config.receptionist.greeting
        .replace('{business_name}', config.business.name)
        .replace('{receptionist_name}', config.receptionist.name);

      // Save greeting to database
      chatHistoryService.saveMessage(sessionId, 'assistant', greeting);

      socket.emit('message', {
        role: 'assistant',
        content: greeting,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('message', async (data: { content: string }) => {
    const sessionId = socketSessions.get(socket.id);
    if (!sessionId) {
      console.error('No session found for socket:', socket.id);
      return;
    }

    const history = conversations.get(sessionId) || [];

    // Add user message to history and save to database
    history.push({ role: 'user', content: data.content });
    chatHistoryService.saveMessage(sessionId, 'user', data.content);

    // Emit typing indicator
    socket.emit('typing', { isTyping: true });

    const config = receptionist.getConfig();

    try {
      // Get AI response
      const response = await receptionist.chat(data.content, history);

      // Add assistant response to history and save to database
      history.push({ role: 'assistant', content: response.message });
      conversations.set(sessionId, history);

      // Determine message type and action data for storage
      let messageType: 'text' | 'confirmation' | 'callback_confirmation' = 'text';
      let actionData: Record<string, unknown> | undefined;

      if (response.action?.type === 'booking_confirmed' && response.action.bookingConfirmation) {
        messageType = 'confirmation';
        actionData = { bookingConfirmation: response.action.bookingConfirmation };
      } else if (response.action?.type === 'callback_confirmed' && response.action.callbackConfirmation) {
        messageType = 'callback_confirmation';
        actionData = { callbackConfirmation: response.action.callbackConfirmation };
      } else if (response.action?.data) {
        actionData = response.action.data;
      }

      // Save message with full action data
      chatHistoryService.saveMessage(sessionId, 'assistant', response.message, {
        messageType,
        actionType: response.action?.type,
        actionData
      });

      // Stop typing indicator
      socket.emit('typing', { isTyping: false });

      // Send response
      socket.emit('message', {
        role: 'assistant',
        content: response.message,
        action: response.action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('typing', { isTyping: false });
      socket.emit('message', {
        role: 'assistant',
        content: config.receptionist.fallbackMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle saving confirmation messages (from form-based bookings)
  socket.on('saveConfirmation', (data: {
    content: string;
    messageType: 'confirmation' | 'callback_confirmation';
    actionType: string;
    actionData: Record<string, unknown>;
  }) => {
    const sessionId = socketSessions.get(socket.id);
    if (!sessionId) {
      console.error('No session found for socket:', socket.id);
      return;
    }

    // Save the confirmation message to database
    chatHistoryService.saveMessage(sessionId, 'assistant', data.content, {
      messageType: data.messageType,
      actionType: data.actionType,
      actionData: data.actionData
    });

    // Add to in-memory history
    const history = conversations.get(sessionId) || [];
    history.push({ role: 'assistant', content: data.content });
    conversations.set(sessionId, history);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    socketSessions.delete(socket.id);
    // Note: We don't delete conversation history from memory or DB
    // This allows session resumption
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initDatabase();

    httpServer.listen(PORT, () => {
      console.log(`AI Receptionist server running on port ${PORT}`);
      console.log(`REST API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };
