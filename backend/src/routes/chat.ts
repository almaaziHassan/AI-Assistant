import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';
import { optionalUserAuth } from '../middleware/userAuth';
import prisma from '../db/prisma';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const receptionist = new ReceptionistService();

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// POST /api/chat - Send a message and get a response
router.post('/', optionalUserAuth, async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body as ChatRequest;
    const user = req.user;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    let chatHistory = history;

    // If authenticated, fetch persistent history and ignore/merge client history
    // For simplicity, if logged in, we rely on DB history + current message
    if (user) {
      const savedChats = await prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20 // Retrieve last 20 messages for context (approx 2 days of active chat)
      });

      // Convert to ChatMessage format and ensure chronological order
      chatHistory = savedChats.reverse().map(c => ({
        role: c.role as 'user' | 'assistant',
        content: c.content
      }));
    }

    const userContext = user ? {
      name: user.name,
      email: user.email,
      phone: user.phone
    } : undefined;

    const response = await receptionist.chat(message, chatHistory, userContext);

    // Persist conversation if authenticated
    if (user) {
      // Use a persistent session ID or generate one. 
      // For now, we group by UserID primarily, so sessionId can be 'default' or a daily ID.
      const sessionId = `user-${user.id}`;

      // 1. Save User Message
      await prisma.conversation.create({
        data: {
          sessionId,
          userId: user.id,
          role: 'user',
          content: message,
          messageType: 'text'
        }
      });

      // 2. Save Assistant Response
      await prisma.conversation.create({
        data: {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: response.message,
          messageType: 'text',
          actionType: response.action?.type,
          actionData: response.action ? JSON.stringify(response.action) : undefined
        }
      });
    }

    res.json({
      message: response.message,
      action: response.action,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// GET /api/chat/greeting - Get the initial greeting
router.get('/greeting', (req: Request, res: Response) => {
  const config = receptionist.getConfig();
  const greeting = config.receptionist.greeting
    .replace('{business_name}', config.business.name)
    .replace('{receptionist_name}', config.receptionist.name);

  res.json({
    message: greeting,
    receptionistName: config.receptionist.name,
    businessName: config.business.name
  });
});

export default router;
