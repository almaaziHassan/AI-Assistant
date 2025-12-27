import { Router, Request, Response } from 'express';
import {
  verifyAdminPassword,
  createSession,
  destroySession,
  validateSession
} from '../middleware/adminAuth';

const router = Router();

// POST /api/auth/login - Admin login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = createSession();

    res.json({
      success: true,
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - Admin logout
router.post('/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      destroySession(token);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/verify - Verify if current session is valid
router.get('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ valid: false });
    }

    const token = authHeader.substring(7);
    const valid = validateSession(token);

    res.json({ valid });
  } catch (error) {
    console.error('Verify error:', error);
    res.json({ valid: false });
  }
});

export default router;
