/**
 * Callbacks Routes - Prisma Implementation
 * 
 * API routes for callback request management.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';
import { adminAuthMiddleware } from '../middleware/adminAuth';

export function createCallbacksRouterPrisma() {
    const router = Router();

    // POST /api/callbacks - Create a new callback request (public)
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { customerName, customerPhone, customerEmail, preferredTime, concerns } = req.body;

            // Validate required fields
            if (!customerName || customerName.trim().length < 2) {
                return res.status(400).json({ error: 'Valid name is required (at least 2 characters)' });
            }

            if (!customerPhone || customerPhone.trim().length < 10) {
                return res.status(400).json({ error: 'Valid phone number is required' });
            }

            // Validate email if provided
            if (customerEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(customerEmail)) {
                    return res.status(400).json({ error: 'Invalid email format' });
                }
            }

            const callback = await prisma.callback.create({
                data: {
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    customerEmail: customerEmail?.trim() || null,
                    preferredTime: preferredTime || null,
                    concerns: concerns?.trim() || null,
                    status: 'pending',
                },
            });

            res.status(201).json(callback);
        } catch (error) {
            console.error('Create callback error:', error);
            res.status(500).json({ error: 'Failed to create callback request' });
        }
    });

    // GET /api/callbacks - Get all callback requests (admin)
    router.get('/', adminAuthMiddleware, async (req: Request, res: Response) => {
        try {
            const { status } = req.query;

            const callbacks = await prisma.callback.findMany({
                where: status ? { status: status as string } : undefined,
                orderBy: { createdAt: 'desc' },
            });

            res.json(callbacks);
        } catch (error) {
            console.error('Get callbacks error:', error);
            res.status(500).json({ error: 'Failed to get callback requests' });
        }
    });

    // GET /api/callbacks/:id - Get a specific callback (admin)
    router.get('/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const callback = await prisma.callback.findUnique({
                where: { id },
            });

            if (!callback) {
                return res.status(404).json({ error: 'Callback request not found' });
            }

            res.json(callback);
        } catch (error) {
            console.error('Get callback error:', error);
            res.status(500).json({ error: 'Failed to get callback request' });
        }
    });

    // PUT /api/callbacks/:id - Update callback status (admin)
    router.put('/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            const validStatuses = ['pending', 'contacted', 'completed', 'no_answer'];
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const calledAt = (status === 'contacted' || status === 'completed') ? new Date() : undefined;

            const callback = await prisma.callback.update({
                where: { id },
                data: {
                    ...(status && { status }),
                    ...(notes !== undefined && { notes }),
                    ...(calledAt && { calledAt }),
                },
            });

            res.json({ success: true, callback });
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Callback request not found' });
            }
            console.error('Update callback error:', error);
            res.status(500).json({ error: 'Failed to update callback request' });
        }
    });

    // DELETE /api/callbacks/:id - Delete a callback request (admin)
    router.delete('/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            await prisma.callback.delete({
                where: { id },
            });

            res.json({ success: true, message: 'Callback request deleted' });
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Callback request not found' });
            }
            console.error('Delete callback error:', error);
            res.status(500).json({ error: 'Failed to delete callback request' });
        }
    });

    return router;
}

export default createCallbacksRouterPrisma();
