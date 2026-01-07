/**
 * User Routes
 * User-specific endpoints (appointments, profile, etc.)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireUserAuth } from '../middleware/userAuth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/users/appointments
 * Get current user's appointments
 */
router.get('/appointments', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userEmail = req.user!.email;
        const { status, upcoming } = req.query;

        // Build where clause - match by userId OR email
        const baseWhere: {
            status?: string;
            appointmentDate?: { gte: Date };
        } = {};

        if (status && typeof status === 'string') {
            baseWhere.status = status;
        }

        if (upcoming === 'true') {
            baseWhere.appointmentDate = { gte: new Date() };
        }

        // Find appointments by userId OR email
        const appointments = await prisma.appointment.findMany({
            where: {
                OR: [
                    { userId },
                    { customerEmail: userEmail.toLowerCase() }
                ],
                ...baseWhere
            },
            orderBy: [
                { appointmentDate: 'asc' },
                { appointmentTime: 'asc' }
            ],
            include: {
                staff: {
                    select: { id: true, name: true }
                },
                location: {
                    select: { id: true, name: true, address: true }
                }
            }
        });

        // Link any unlinked appointments to this user
        const unlinkedIds = appointments
            .filter(apt => !apt.userId && apt.customerEmail?.toLowerCase() === userEmail.toLowerCase())
            .map(apt => apt.id);

        if (unlinkedIds.length > 0) {
            await prisma.appointment.updateMany({
                where: { id: { in: unlinkedIds } },
                data: { userId }
            });
        }

        // Format appointments for response
        const formattedAppointments = appointments.map(apt => ({
            id: apt.id,
            serviceName: apt.serviceName,
            serviceId: apt.serviceId,
            date: apt.appointmentDate.toISOString().split('T')[0],
            time: apt.appointmentTime.toISOString().split('T')[1].substring(0, 5),
            duration: apt.duration,
            status: apt.status,
            staffName: apt.staffName || apt.staff?.name,
            staffId: apt.staffId,
            location: apt.location?.name,
            notes: apt.notes,
            createdAt: apt.createdAt
        }));

        res.json(formattedAppointments);
    } catch (error) {
        console.error('Get user appointments error:', error);
        res.status(500).json({ error: 'Failed to get appointments' });
    }
});

/**
 * GET /api/users/appointments/:id
 * Get a specific appointment (must belong to user)
 */
router.get('/appointments/:id', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const appointment = await prisma.appointment.findFirst({
            where: { id, userId },
            include: {
                staff: {
                    select: { id: true, name: true, email: true }
                },
                location: {
                    select: { id: true, name: true, address: true, phone: true }
                }
            }
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({
            id: appointment.id,
            serviceName: appointment.serviceName,
            serviceId: appointment.serviceId,
            date: appointment.appointmentDate.toISOString().split('T')[0],
            time: appointment.appointmentTime.toISOString().split('T')[1].substring(0, 5),
            duration: appointment.duration,
            status: appointment.status,
            staffName: appointment.staffName || appointment.staff?.name,
            staffId: appointment.staffId,
            location: appointment.location,
            notes: appointment.notes,
            createdAt: appointment.createdAt
        });
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({ error: 'Failed to get appointment' });
    }
});

/**
 * PUT /api/users/appointments/:id/cancel
 * Cancel an appointment (must belong to user)
 */
router.put('/appointments/:id/cancel', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        // Find appointment and verify ownership
        const appointment = await prisma.appointment.findFirst({
            where: { id, userId }
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Check if appointment is in the future
        const appointmentDateTime = new Date(appointment.appointmentDate);
        if (appointmentDateTime < new Date()) {
            return res.status(400).json({ error: 'Cannot cancel past appointments' });
        }

        // Check if already cancelled
        if (appointment.status === 'cancelled') {
            return res.status(400).json({ error: 'Appointment is already cancelled' });
        }

        // Cancel appointment
        await prisma.appointment.update({
            where: { id },
            data: { status: 'cancelled' }
        });

        res.json({
            success: true,
            message: 'Appointment cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({ error: 'Failed to cancel appointment' });
    }
});

/**
 * GET /api/users/stats
 * Get user's appointment statistics
 */
router.get('/stats', requireUserAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get counts
        const [totalAppointments, upcomingAppointments, completedAppointments, cancelledAppointments] = await Promise.all([
            prisma.appointment.count({ where: { userId } }),
            prisma.appointment.count({
                where: {
                    userId,
                    appointmentDate: { gte: today },
                    status: { in: ['confirmed', 'pending'] }
                }
            }),
            prisma.appointment.count({
                where: { userId, status: 'completed' }
            }),
            prisma.appointment.count({
                where: { userId, status: 'cancelled' }
            })
        ]);

        // Get next appointment
        const nextAppointment = await prisma.appointment.findFirst({
            where: {
                userId,
                appointmentDate: { gte: today },
                status: { in: ['confirmed', 'pending'] }
            },
            orderBy: [
                { appointmentDate: 'asc' },
                { appointmentTime: 'asc' }
            ]
        });

        res.json({
            totalAppointments,
            upcomingAppointments,
            completedAppointments,
            cancelledAppointments,
            nextAppointment: nextAppointment ? {
                id: nextAppointment.id,
                serviceName: nextAppointment.serviceName,
                date: nextAppointment.appointmentDate.toISOString().split('T')[0],
                time: nextAppointment.appointmentTime.toISOString().split('T')[1].substring(0, 5)
            } : null
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
