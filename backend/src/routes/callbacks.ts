import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../db/database';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

interface CallbackRequest {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  preferredTime?: string;
  concerns?: string;
}

interface Callback {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  preferredTime?: string;
  concerns?: string;
  status: 'pending' | 'contacted' | 'completed' | 'no_answer';
  notes?: string;
  calledAt?: string;
  createdAt: string;
}

// POST /api/callbacks - Create a new callback request
router.post('/', (req: Request, res: Response) => {
  try {
    const callback: CallbackRequest = req.body;

    // Validate required fields
    if (!callback.customerName || callback.customerName.trim().length < 2) {
      return res.status(400).json({ error: 'Valid name is required (at least 2 characters)' });
    }

    if (!callback.customerPhone || callback.customerPhone.trim().length < 10) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    // Validate email if provided
    if (callback.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(callback.customerEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO callbacks (id, customer_name, customer_phone, customer_email, preferred_time, concerns, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        callback.customerName.trim(),
        callback.customerPhone.trim(),
        callback.customerEmail?.trim() || null,
        callback.preferredTime || null,
        callback.concerns?.trim() || null,
        now
      ]
    );

    res.status(201).json({
      id,
      customerName: callback.customerName,
      customerPhone: callback.customerPhone,
      status: 'pending',
      createdAt: now
    });
  } catch (error) {
    console.error('Create callback error:', error);
    res.status(500).json({ error: 'Failed to create callback request' });
  }
});

// GET /api/callbacks - Get all callback requests (admin)
router.get('/', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let sql = 'SELECT * FROM callbacks ORDER BY created_at DESC';
    const params: string[] = [];

    if (status && typeof status === 'string') {
      sql = 'SELECT * FROM callbacks WHERE status = ? ORDER BY created_at DESC';
      params.push(status);
    }

    const rows = getAll(sql, params);
    const callbacks: Callback[] = rows.map(row => ({
      id: row.id as string,
      customerName: row.customer_name as string,
      customerPhone: row.customer_phone as string,
      customerEmail: row.customer_email as string | undefined,
      preferredTime: row.preferred_time as string | undefined,
      concerns: row.concerns as string | undefined,
      status: row.status as Callback['status'],
      notes: row.notes as string | undefined,
      calledAt: row.called_at as string | undefined,
      createdAt: row.created_at as string
    }));

    res.json(callbacks);
  } catch (error) {
    console.error('Get callbacks error:', error);
    res.status(500).json({ error: 'Failed to get callback requests' });
  }
});

// GET /api/callbacks/:id - Get a specific callback (admin)
router.get('/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = getOne('SELECT * FROM callbacks WHERE id = ?', [id]);

    if (!row) {
      return res.status(404).json({ error: 'Callback request not found' });
    }

    const callback: Callback = {
      id: row.id as string,
      customerName: row.customer_name as string,
      customerPhone: row.customer_phone as string,
      customerEmail: row.customer_email as string | undefined,
      preferredTime: row.preferred_time as string | undefined,
      concerns: row.concerns as string | undefined,
      status: row.status as Callback['status'],
      notes: row.notes as string | undefined,
      calledAt: row.called_at as string | undefined,
      createdAt: row.created_at as string
    };

    res.json(callback);
  } catch (error) {
    console.error('Get callback error:', error);
    res.status(500).json({ error: 'Failed to get callback request' });
  }
});

// PUT /api/callbacks/:id - Update callback status (admin)
router.put('/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const existing = getOne('SELECT * FROM callbacks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Callback request not found' });
    }

    const validStatuses = ['pending', 'contacted', 'completed', 'no_answer'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const calledAt = status === 'contacted' || status === 'completed' ? new Date().toISOString() : null;

    runQuery(
      `UPDATE callbacks SET status = COALESCE(?, status), notes = COALESCE(?, notes), called_at = COALESCE(?, called_at) WHERE id = ?`,
      [status || null, notes || null, calledAt, id]
    );

    res.json({ success: true, id, status: status || existing.status });
  } catch (error) {
    console.error('Update callback error:', error);
    res.status(500).json({ error: 'Failed to update callback request' });
  }
});

// DELETE /api/callbacks/:id - Delete a callback request (admin)
router.delete('/:id', adminAuthMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = getOne('SELECT * FROM callbacks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Callback request not found' });
    }

    runQuery('DELETE FROM callbacks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Callback request deleted' });
  } catch (error) {
    console.error('Delete callback error:', error);
    res.status(500).json({ error: 'Failed to delete callback request' });
  }
});

export default router;
