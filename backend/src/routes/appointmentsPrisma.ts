/**
 * Appointments Routes - Prisma Implementation
 * 
 * API routes for appointment booking and management using Prisma ORM.
 */

import { Router, Request, Response } from 'express';
import { SchedulerServicePrisma, BookingRequest, schedulerServicePrisma } from '../services/schedulerPrisma';
import { emailService, EmailService } from '../services/email';
import { validateBookingRequest } from '../middleware/validation';
import prisma from '../db/prisma';

export function createAppointmentRouterPrisma(
    scheduler: SchedulerServicePrisma = schedulerServicePrisma,
    emailSvc: EmailService = emailService
) {
    const router = Router();

    // GET /api/appointments/slots - Get available time slots
    router.get('/slots', async (req: Request, res: Response) => {
        try {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');

            const { date, serviceId, staffId } = req.query;
            console.log(`[slots] Request: date=${date}, serviceId=${serviceId}, staffId=${staffId}`);

            if (!date || typeof date !== 'string') {
                return res.status(400).json({ error: 'Date is required (YYYY-MM-DD format)' });
            }

            if (!serviceId || typeof serviceId !== 'string') {
                return res.status(400).json({ error: 'Service ID is required' });
            }

            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
            }

            const staffIdStr = typeof staffId === 'string' ? staffId : undefined;
            const timezoneOffset = req.query.tz ? parseInt(req.query.tz as string, 10) : undefined;

            const slots = await scheduler.getAvailableSlots(date, serviceId, staffIdStr, timezoneOffset);
            console.log(`[slots] Returning ${slots.length} slots for ${date}`);
            res.json({ date, serviceId, staffId: staffIdStr, slots });
        } catch (error) {
            console.error('Get slots error:', error);
            res.status(500).json({ error: 'Failed to get available slots' });
        }
    });

    // POST /api/appointments - Book a new appointment
    router.post('/', validateBookingRequest, async (req: Request, res: Response) => {
        try {
            const booking: BookingRequest = req.body;
            const appointment = await scheduler.bookAppointment(booking);

            // Send confirmation email (non-blocking)
            emailSvc.sendConfirmationEmail(appointment as any).catch(err => {
                console.error('Failed to send confirmation email:', err);
            });

            res.status(201).json({
                ...appointment,
                emailSent: true,
            });
        } catch (error) {
            console.error('Booking error:', error);
            const message = error instanceof Error ? error.message : 'Failed to book appointment';
            res.status(400).json({ error: message });
        }
    });

    // GET /api/appointments/needing-action - Get past appointments that need status update
    router.get('/needing-action', async (_req: Request, res: Response) => {
        try {
            const appointments = await scheduler.getAppointmentsNeedingAction();
            res.json(appointments);
        } catch (error) {
            console.error('Get needing action error:', error);
            res.status(500).json({ error: 'Failed to get appointments needing action' });
        }
    });

    // GET /api/appointments/stats - Get appointment statistics
    router.get('/stats', async (_req: Request, res: Response) => {
        try {
            const stats = await scheduler.getAppointmentStats();
            res.json(stats);
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({ error: 'Failed to get appointment statistics' });
        }
    });

    // GET /api/appointments/my-appointments - Get appointments for logged-in user
    // Fetches appointments that belong to this user:
    // 1. Appointments where userId matches (booked while logged in as this user)
    // 2. Appointments where customerEmail matches AND userId is NULL (booked with their email while NOT logged in)
    // This prevents User A from seeing User B's appointments just because emails match
    // NOTE: This route MUST be before /:id to prevent matching "my-appointments" as an ID
    router.get('/my-appointments', async (req: Request, res: Response) => {
        try {
            const userId = req.query.userId as string;
            const email = req.query.email as string;

            if (!userId && !email) {
                return res.status(400).json({ error: 'userId or email is required' });
            }

            // Build conditions for proper ownership matching:
            // - Match by userId (appointments made while logged in as this user)
            // - OR match by email ONLY if the appointment has no userId (made while logged out)
            const whereConditions: any[] = [];

            if (userId) {
                // Appointments explicitly linked to this user's account
                whereConditions.push({ userId: userId });
            }

            if (email) {
                // Appointments made with this email but NOT linked to any user account
                // (i.e., booked while logged out or before account creation)
                whereConditions.push({
                    customerEmail: email.toLowerCase(),
                    userId: null  // Important: Only match if no userId is set
                });
            }

            const appointments = await prisma.appointment.findMany({
                where: {
                    OR: whereConditions
                    // Note: Don't filter by status here - we want to return all appointments
                    // The frontend will filter into upcoming/past tabs including cancelled ones
                },
                orderBy: { appointmentDate: 'asc' }
            });

            // Format and deduplicate (in case same booking matches both conditions)
            const seen = new Set();
            const formatted = appointments
                .filter(apt => {
                    if (seen.has(apt.id)) return false;
                    seen.add(apt.id);
                    return true;
                })
                .map(apt => ({
                    id: apt.id,
                    customerName: apt.customerName,
                    customerEmail: apt.customerEmail,
                    customerPhone: apt.customerPhone,
                    serviceId: apt.serviceId,
                    serviceName: apt.serviceName,
                    staffId: apt.staffId,
                    staffName: apt.staffName,
                    date: apt.appointmentDate.toISOString().split('T')[0],
                    time: apt.appointmentTime.toISOString().split('T')[1].substring(0, 5),
                    duration: apt.duration,
                    status: apt.status || 'confirmed',
                    notes: apt.notes,
                    userId: apt.userId
                }));

            res.json(formatted);
        } catch (error) {
            console.error('Get my appointments error:', error);
            res.status(500).json({ error: 'Failed to get appointments' });
        }
    });

    // GET /api/appointments/:id - Get an appointment by ID
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const appointment = await scheduler.getAppointment(id);

            if (!appointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json(appointment);
        } catch (error) {
            console.error('Get appointment error:', error);
            res.status(500).json({ error: 'Failed to get appointment' });
        }
    });

    // GET /api/appointments/by-email/:email - Get appointments by email
    router.get('/by-email/:email', async (req: Request, res: Response) => {
        try {
            const { email } = req.params;
            const appointments = await scheduler.getAppointmentsByEmail(email);
            res.json(appointments);
        } catch (error) {
            console.error('Get appointments error:', error);
            res.status(500).json({ error: 'Failed to get appointments' });
        }
    });

    // GET /api/appointments/by-user/:userId - Get appointments by user ID
    // This is more reliable than by-email since it links directly to the user account
    router.get('/by-user/:userId', async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;

            // Get appointments linked to this user ID
            const appointments = await prisma.appointment.findMany({
                where: {
                    userId: userId,
                    status: { not: 'cancelled' }
                },
                orderBy: { appointmentDate: 'asc' }
            });

            // Format appointments to match expected structure
            const formatted = appointments.map(apt => ({
                id: apt.id,
                customerName: apt.customerName,
                customerEmail: apt.customerEmail,
                customerPhone: apt.customerPhone,
                serviceId: apt.serviceId,
                serviceName: apt.serviceName,
                staffId: apt.staffId,
                staffName: apt.staffName,
                date: apt.appointmentDate.toISOString().split('T')[0],
                time: apt.appointmentTime.toISOString().split('T')[1].substring(0, 5),
                duration: apt.duration,
                status: apt.status || 'confirmed',
                notes: apt.notes,
                userId: apt.userId
            }));

            res.json(formatted);
        } catch (error) {
            console.error('Get appointments by user error:', error);
            res.status(500).json({ error: 'Failed to get appointments' });
        }
    });

    // GET /api/appointments/by-date/:date - Get appointments by date
    router.get('/by-date/:date', async (req: Request, res: Response) => {
        try {
            const { date } = req.params;
            const appointments = await scheduler.getAppointmentsByDate(date);
            res.json(appointments);
        } catch (error) {
            console.error('Get appointments error:', error);
            res.status(500).json({ error: 'Failed to get appointments' });
        }
    });
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const success = await scheduler.cancelAppointment(id);

            if (!success) {
                return res.status(404).json({ error: 'Appointment not found or cannot be cancelled' });
            }

            res.json({ message: 'Appointment cancelled successfully' });
        } catch (error) {
            console.error('Cancel appointment error:', error);
            res.status(500).json({ error: 'Failed to cancel appointment' });
        }
    });

    // POST /api/appointments/:id/reschedule - Reschedule appointment
    router.post('/:id/reschedule', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { date, time, email } = req.body;

            if (!date || !time) {
                return res.status(400).json({ error: 'Date and time are required' });
            }

            const existing = await scheduler.getAppointment(id);
            if (!existing) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            if (email && email.toLowerCase() !== existing.customerEmail.toLowerCase()) {
                return res.status(403).json({ error: 'Email does not match appointment' });
            }

            const slots = await scheduler.getAvailableSlots(date, existing.serviceId);
            const slot = slots.find(s => s.time === time);

            if (!slot || !slot.available) {
                return res.status(400).json({ error: 'Selected time slot is not available' });
            }

            const updated = await prisma.appointment.update({
                where: { id },
                data: {
                    appointmentDate: new Date(date),
                    appointmentTime: new Date(`1970-01-01T${time}:00`),
                    updatedAt: new Date(),
                },
            });

            // Send updated confirmation email
            const updatedAppointment = await scheduler.getAppointment(id);
            if (updatedAppointment) {
                emailSvc.sendConfirmationEmail(updatedAppointment as any).catch(err => {
                    console.error('Failed to send rescheduled confirmation email:', err);
                });
            }

            res.json(updatedAppointment);
        } catch (error) {
            console.error('Reschedule error:', error);
            res.status(500).json({ error: 'Failed to reschedule appointment' });
        }
    });

    // POST /api/appointments/lookup - Look up appointments by email
    router.post('/lookup', async (req: Request, res: Response) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const appointments = await scheduler.getAppointmentsByEmail(email);
            const today = new Date().toISOString().split('T')[0];

            const upcomingAppointments = appointments.filter(
                apt => apt.appointmentDate >= today && apt.status === 'confirmed'
            );

            res.json(upcomingAppointments);
        } catch (error) {
            console.error('Lookup error:', error);
            res.status(500).json({ error: 'Failed to lookup appointments' });
        }
    });

    // PATCH /api/appointments/:id/status - Update appointment status
    router.patch('/:id/status', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status, tz } = req.body;

            const validStatuses = ['pending', 'confirmed', 'completed', 'no-show', 'cancelled'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
            }

            const timezoneOffset = typeof tz === 'number' ? tz : undefined;
            const result = await scheduler.updateAppointmentStatus(id, status, timezoneOffset);

            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }

            const updated = await scheduler.getAppointment(id);
            res.json(updated);
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ error: 'Failed to update appointment status' });
        }
    });

    return router;
}

export default createAppointmentRouterPrisma();
