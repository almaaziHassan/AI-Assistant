import { Router, Request, Response } from 'express';
import { SchedulerService, BookingRequest } from '../services/scheduler';
import { emailService, EmailService } from '../services/email';
import { validateBookingRequest } from '../middleware/validation';

export function createAppointmentRouter(
  scheduler: SchedulerService = new SchedulerService(),
  emailSvc: EmailService = emailService
) {
  const router = Router();

  // GET /api/appointments/slots - Get available time slots
  router.get('/slots', (req: Request, res: Response) => {
    try {
      // Prevent caching
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

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      // staffId is optional - if provided, get slots for specific staff only
      const staffIdStr = typeof staffId === 'string' ? staffId : undefined;

      // timezoneOffset is optional - client's timezone offset in minutes (e.g., -300 for EST)
      const timezoneOffset = req.query.tz ? parseInt(req.query.tz as string, 10) : undefined;

      const slots = scheduler.getAvailableSlots(date, serviceId, staffIdStr, timezoneOffset);
      console.log(`[slots] Returning ${slots.length} slots for ${date} (tz offset: ${timezoneOffset ?? 'server'})`);
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

      // Inputs are already validated and sanitized by middleware
      const appointment = await scheduler.bookAppointment(booking);

      // Send confirmation email (non-blocking)
      emailSvc.sendConfirmationEmail(appointment).catch(err => {
        console.error('Failed to send confirmation email:', err);
      });

      res.status(201).json({
        ...appointment,
        emailSent: true
      });
    } catch (error) {
      console.error('Booking error:', error);
      const message = error instanceof Error ? error.message : 'Failed to book appointment';
      res.status(400).json({ error: message });
    }
  });

  // GET /api/appointments/needing-action - Get past appointments that need status update
  // NOTE: Must be before /:id route to avoid matching 'needing-action' as an ID
  router.get('/needing-action', (_req: Request, res: Response) => {
    try {
      const appointments = scheduler.getAppointmentsNeedingAction();
      res.json(appointments);
    } catch (error) {
      console.error('Get needing action error:', error);
      res.status(500).json({ error: 'Failed to get appointments needing action' });
    }
  });

  // GET /api/appointments/stats - Get appointment statistics
  // NOTE: Must be before /:id route to avoid matching 'stats' as an ID
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const stats = scheduler.getAppointmentStats();
      res.json(stats);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to get appointment statistics' });
    }
  });

  // GET /api/appointments/:id - Get an appointment by ID
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const appointment = scheduler.getAppointment(id);

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
  router.get('/by-email/:email', (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      const appointments = scheduler.getAppointmentsByEmail(email);
      res.json(appointments);
    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({ error: 'Failed to get appointments' });
    }
  });

  // GET /api/appointments/by-date/:date - Get appointments by date
  router.get('/by-date/:date', (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const appointments = scheduler.getAppointmentsByDate(date);
      res.json(appointments);
    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({ error: 'Failed to get appointments' });
    }
  });

  // DELETE /api/appointments/:id - Cancel an appointment
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = scheduler.cancelAppointment(id);

      if (!success) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      res.json({ message: 'Appointment cancelled successfully' });
    } catch (error) {
      console.error('Cancel appointment error:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  });

  // POST /api/appointments/:id/reschedule - Reschedule appointment (customer-facing)
  router.post('/:id/reschedule', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { date, time, email } = req.body;

      if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required' });
      }

      // Get existing appointment
      const existing = scheduler.getAppointment(id);
      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Verify email matches (basic security)
      if (email && email.toLowerCase() !== existing.customerEmail.toLowerCase()) {
        return res.status(403).json({ error: 'Email does not match appointment' });
      }

      // Check if new slot is available
      const slots = scheduler.getAvailableSlots(date, existing.serviceId);
      const slot = slots.find(s => s.time === time);

      if (!slot || !slot.available) {
        return res.status(400).json({ error: 'Selected time slot is not available' });
      }

      // Import runQuery
      const { runQuery } = await import('../db/database');

      // Update the appointment
      runQuery(
        `UPDATE appointments SET appointment_date = ?, appointment_time = ?, updated_at = ? WHERE id = ?`,
        [date, time, new Date().toISOString(), id]
      );

      const updated = scheduler.getAppointment(id);

      // Send updated confirmation email
      if (updated) {
        emailSvc.sendConfirmationEmail(updated).catch(err => {
          console.error('Failed to send rescheduled confirmation email:', err);
        });
      }

      res.json(updated);
    } catch (error) {
      console.error('Reschedule error:', error);
      res.status(500).json({ error: 'Failed to reschedule appointment' });
    }
  });

  // POST /api/appointments/lookup - Look up appointments by email
  router.post('/lookup', (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const appointments = scheduler.getAppointmentsByEmail(email);

      // Filter to only show upcoming and confirmed appointments
      const today = new Date().toISOString().split('T')[0];
      const upcomingAppointments = appointments.filter(apt =>
        apt.appointmentDate >= today && apt.status === 'confirmed'
      );

      res.json(upcomingAppointments);
    } catch (error) {
      console.error('Lookup error:', error);
      res.status(500).json({ error: 'Failed to lookup appointments' });
    }
  });

  // PATCH /api/appointments/:id/status - Update appointment status
  router.patch('/:id/status', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, tz } = req.body;

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'completed', 'no-show', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }

      // Parse timezone offset if provided
      const timezoneOffset = typeof tz === 'number' ? tz : undefined;

      const result = scheduler.updateAppointmentStatus(id, status, timezoneOffset);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const updated = scheduler.getAppointment(id);
      res.json(updated);
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update appointment status' });
    }
  });

  return router;
}

// Export default instance for backwards compatibility
export default createAppointmentRouter();
