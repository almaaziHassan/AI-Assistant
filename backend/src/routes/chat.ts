import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';

const router = Router();
const receptionist = new ReceptionistService();

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// POST /api/chat - Send a message and get a response
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body as ChatRequest;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await receptionist.chat(message, history);

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
