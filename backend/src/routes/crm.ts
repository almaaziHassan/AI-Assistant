import express, { Request, Response } from 'express';
import { crmService } from '../services/crm';
import { emailService } from '../services/email';

const router = express.Router();

/**
 * GET /api/admin/crm/contacts
 * Query Params: page, limit, search, filter
 */
router.get('/contacts', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const filter = req.query.filter as 'vip' | 'at-risk' | 'all';

        const result = await crmService.getContacts(page, limit, search, filter);
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch CRM contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

/**
 * POST /api/admin/crm/sync
 * Manually trigger synchronization of Guests -> ContactProfiles
 */
router.post('/sync', async (req: Request, res: Response) => {
    try {
        const result = await crmService.syncContacts();
        res.json({ message: 'Sync complete', ...result });
    } catch (error) {
        console.error('CRM Sync failed:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
});

/**
 * GET /api/admin/crm/contacts/:id
 * Get details by Profile ID or Email
 */
router.get('/contacts/:id', async (req: Request, res: Response) => {
    try {
        const result = await crmService.getCustomerDetails(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(result);
    } catch (error) {
        console.error('Failed to fetch contact details:', error);
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
});

/**
 * PATCH /api/admin/crm/contacts/:id
 * Update metadata (notes, tags, block status)
 */
router.patch('/contacts/:id', async (req: Request, res: Response) => {
    try {
        const { notes, tags, isBlocked } = req.body;

        // Security: Input sanitization handled by logic/ORM safety, but good to be mindful.
        // Prisma protects against SQLi. Logic handles types.

        const updated = await crmService.updateProfile(req.params.id, {
            notes,
            tags,
            isBlocked
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to update contact:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

/**
 * POST /api/admin/crm/contacts/:id/email
 * Send a direct email to the customer
 */
router.post('/contacts/:id/email', async (req: Request, res: Response) => {
    try {
        const { subject, message } = req.body;
        const profile = await crmService.getCustomerDetails(req.params.id);

        if (!profile) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        const emailSent = await emailService.sendEmail({
            to: profile.profile.email,
            subject: subject,
            html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
            text: message
        });

        if (emailSent) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to send email' });
        }

    } catch (error) {
        console.error('Failed to send CRM email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/crm/broadcast
 * Send bulk email to a segment
 */
router.post('/broadcast', async (req: Request, res: Response) => {
    try {
        const { segment, subject, message } = req.body;
        console.log('Received Broadcast Request:', { segment, subject, messageLen: message?.length });

        if (!['all', 'vip', 'guests'].includes(segment)) {
            return res.status(400).json({ error: 'Invalid segment' });
        }

        const stats = await crmService.sendBroadcast(segment, subject, message);
        res.json(stats);
    } catch (error) {
        console.error('Broadcast failed:', error);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

export default router;
