import { Router, Request, Response } from 'express';
import { adminService, AdminService } from '../services/admin';
import { SchedulerService } from '../services/scheduler';

export function createAdminRouter(
  adminSvc: AdminService = adminService,
  scheduler: SchedulerService = new SchedulerService()
) {
  const router = Router();

  // ============ DASHBOARD ============

  // GET /api/admin/dashboard - Get dashboard statistics
  router.get('/dashboard', (req: Request, res: Response) => {
    try {
      const stats = adminSvc.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  });

  // GET /api/admin/appointments - Get all appointments with pagination
  router.get('/appointments', (req: Request, res: Response) => {
    try {
      const { status, limit, offset, startDate, endDate } = req.query;

      if (startDate && endDate) {
        const appointments = adminSvc.getAppointmentsForDateRange(
          startDate as string,
          endDate as string
        );
        return res.json(appointments);
      }

      const appointments = adminSvc.getAllAppointments({
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      res.json(appointments);
    } catch (error) {
      console.error('Get appointments error:', error);
      res.status(500).json({ error: 'Failed to get appointments' });
    }
  });

  // ============ STAFF MANAGEMENT ============

  // GET /api/admin/staff - Get all staff
  router.get('/staff', (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const staff = adminSvc.getAllStaff(activeOnly);
      res.json(staff);
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({ error: 'Failed to get staff' });
    }
  });

  // POST /api/admin/staff - Create new staff member
  router.post('/staff', (req: Request, res: Response) => {
    try {
      const { name, email, phone, role, services, color, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const staff = adminSvc.createStaff({
        name,
        email,
        phone,
        role: role || 'staff',
        services: services || [],
        color,
        isActive: isActive !== false
      });

      res.status(201).json(staff);
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({ error: 'Failed to create staff' });
    }
  });

  // PUT /api/admin/staff/:id - Update staff member
  router.put('/staff/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const staff = adminSvc.updateStaff(id, req.body);

      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      res.json(staff);
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({ error: 'Failed to update staff' });
    }
  });

  // DELETE /api/admin/staff/:id - Delete staff member
  router.delete('/staff/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = adminSvc.deleteStaff(id);

      if (!success) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  });

  // ============ SERVICE MANAGEMENT ============

  // GET /api/admin/services - Get all services
  router.get('/services', (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const services = adminSvc.getAllServices(activeOnly);
      res.json(services);
    } catch (error) {
      console.error('Get services error:', error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  });

  // GET /api/admin/services/:id - Get specific service
  router.get('/services/:id', (req: Request, res: Response) => {
    try {
      const service = adminSvc.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.json(service);
    } catch (error) {
      console.error('Get service error:', error);
      res.status(500).json({ error: 'Failed to get service' });
    }
  });

  // POST /api/admin/services - Create new service
  router.post('/services', (req: Request, res: Response) => {
    try {
      const { name, description, duration, price, isActive, displayOrder } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!duration || duration <= 0) {
        return res.status(400).json({ error: 'Duration must be a positive number' });
      }
      if (price === undefined || price < 0) {
        return res.status(400).json({ error: 'Price must be a non-negative number' });
      }

      const service = adminSvc.createService({
        name,
        description,
        duration: Number(duration),
        price: Number(price),
        isActive: isActive !== false,
        displayOrder: displayOrder || 0
      });

      res.status(201).json(service);
    } catch (error) {
      console.error('Create service error:', error);
      res.status(500).json({ error: 'Failed to create service' });
    }
  });

  // PUT /api/admin/services/:id - Update service
  router.put('/services/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const service = adminSvc.updateService(id, req.body);

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      res.json(service);
    } catch (error) {
      console.error('Update service error:', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  });

  // DELETE /api/admin/services/:id - Delete service
  router.delete('/services/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = adminSvc.deleteService(id);

      if (!success) {
        return res.status(404).json({ error: 'Service not found' });
      }

      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Delete service error:', error);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // ============ LOCATION MANAGEMENT ============

  // GET /api/admin/locations - Get all locations
  router.get('/locations', (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const locations = adminSvc.getAllLocations(activeOnly);
      res.json(locations);
    } catch (error) {
      console.error('Get locations error:', error);
      res.status(500).json({ error: 'Failed to get locations' });
    }
  });

  // POST /api/admin/locations - Create new location
  router.post('/locations', (req: Request, res: Response) => {
    try {
      const { name, address, phone, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const location = adminSvc.createLocation({
        name,
        address,
        phone,
        isActive: isActive !== false
      });

      res.status(201).json(location);
    } catch (error) {
      console.error('Create location error:', error);
      res.status(500).json({ error: 'Failed to create location' });
    }
  });

  // PUT /api/admin/locations/:id - Update location
  router.put('/locations/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const location = adminSvc.updateLocation(id, req.body);

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json(location);
    } catch (error) {
      console.error('Update location error:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  });

  // DELETE /api/admin/locations/:id - Delete location
  router.delete('/locations/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = adminSvc.deleteLocation(id);

      if (!success) {
        return res.status(404).json({ error: 'Location not found' });
      }

      res.json({ message: 'Location deleted successfully' });
    } catch (error) {
      console.error('Delete location error:', error);
      res.status(500).json({ error: 'Failed to delete location' });
    }
  });

  // ============ HOLIDAY MANAGEMENT ============

  // GET /api/admin/holidays - Get all holidays
  router.get('/holidays', (req: Request, res: Response) => {
    try {
      const futureOnly = req.query.future === 'true';
      const holidays = adminSvc.getAllHolidays(futureOnly);
      res.json(holidays);
    } catch (error) {
      console.error('Get holidays error:', error);
      res.status(500).json({ error: 'Failed to get holidays' });
    }
  });

  // POST /api/admin/holidays - Create new holiday
  router.post('/holidays', (req: Request, res: Response) => {
    try {
      const { date, name, isClosed, customHoursOpen, customHoursClose } = req.body;

      if (!date || !name) {
        return res.status(400).json({ error: 'Date and name are required' });
      }

      // Check if holiday already exists for this date
      const existing = adminSvc.getHolidayByDate(date);
      if (existing) {
        return res.status(400).json({ error: 'A holiday already exists for this date' });
      }

      const holiday = adminSvc.createHoliday({
        date,
        name,
        isClosed: isClosed !== false,
        customHoursOpen,
        customHoursClose
      });

      res.status(201).json(holiday);
    } catch (error) {
      console.error('Create holiday error:', error);
      res.status(500).json({ error: 'Failed to create holiday' });
    }
  });

  // PUT /api/admin/holidays/:id - Update holiday
  router.put('/holidays/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const holiday = adminSvc.updateHoliday(id, req.body);

      if (!holiday) {
        return res.status(404).json({ error: 'Holiday not found' });
      }

      res.json(holiday);
    } catch (error) {
      console.error('Update holiday error:', error);
      res.status(500).json({ error: 'Failed to update holiday' });
    }
  });

  // DELETE /api/admin/holidays/:id - Delete holiday
  router.delete('/holidays/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = adminSvc.deleteHoliday(id);

      if (!success) {
        return res.status(404).json({ error: 'Holiday not found' });
      }

      res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
      console.error('Delete holiday error:', error);
      res.status(500).json({ error: 'Failed to delete holiday' });
    }
  });

  // ============ APPOINTMENT MANAGEMENT ============

  // PUT /api/admin/appointments/:id/reschedule - Reschedule appointment
  router.put('/appointments/:id/reschedule', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { date, time } = req.body;

      if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required' });
      }

      // Get existing appointment
      const existing = scheduler.getAppointment(id);
      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Check if new slot is available
      const slots = scheduler.getAvailableSlots(date, existing.serviceId);
      const slot = slots.find(s => s.time === time);

      if (!slot || !slot.available) {
        return res.status(400).json({ error: 'Selected time slot is not available' });
      }

      // Update the appointment
      const { runQuery } = await import('../db/database');
      runQuery(
        `UPDATE appointments SET appointment_date = ?, appointment_time = ?, updated_at = ? WHERE id = ?`,
        [date, time, new Date().toISOString(), id]
      );

      const updated = scheduler.getAppointment(id);
      res.json(updated);
    } catch (error) {
      console.error('Reschedule error:', error);
      res.status(500).json({ error: 'Failed to reschedule appointment' });
    }
  });

  // PUT /api/admin/appointments/:id/cancel - Cancel appointment
  router.put('/appointments/:id/cancel', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = scheduler.cancelAppointment(id);

      if (!success) {
        return res.status(404).json({ error: 'Appointment not found or already past' });
      }

      res.json({ message: 'Appointment cancelled successfully' });
    } catch (error) {
      console.error('Cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  });



  // ============ KNOWLEDGE BASE (FAQs) ============

  // GET /api/admin/faqs - Get all FAQs
  router.get('/faqs', (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const faqs = adminSvc.getAllFAQs(activeOnly);
      res.json(faqs);
    } catch (error) {
      console.error('Get FAQs error:', error);
      res.status(500).json({ error: 'Failed to get FAQs' });
    }
  });

  // POST /api/admin/faqs - Create FAQ
  router.post('/faqs', (req: Request, res: Response) => {
    try {
      const { question, answer, keywords, displayOrder, isActive } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ error: 'Question and answer are required' });
      }

      const faq = adminSvc.createFAQ({
        question,
        answer,
        keywords: keywords || [],
        displayOrder,
        isActive: isActive !== false
      });
      res.status(201).json(faq);
    } catch (error) {
      console.error('Create FAQ error:', error);
      res.status(500).json({ error: 'Failed to create FAQ' });
    }
  });

  // PUT /api/admin/faqs/:id - Update FAQ
  router.put('/faqs/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const faq = adminSvc.updateFAQ(id, req.body);
      if (!faq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      res.json(faq);
    } catch (error) {
      console.error('Update FAQ error:', error);
      res.status(500).json({ error: 'Failed to update FAQ' });
    }
  });

  // DELETE /api/admin/faqs/:id - Delete FAQ
  router.delete('/faqs/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = adminSvc.deleteFAQ(id);
      if (!success) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      res.json({ message: 'FAQ deleted successfully' });
    } catch (error) {
      console.error('Delete FAQ error:', error);
      res.status(500).json({ error: 'Failed to delete FAQ' });
    }
  });

  // ============ SYSTEM SETTINGS ============

  // GET /api/admin/settings - Get all settings
  router.get('/settings', (req: Request, res: Response) => {
    try {
      const settings = adminSvc.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  // GET /api/admin/settings/:key - Get setting by key
  router.get('/settings/:key', (req: Request, res: Response) => {
    try {
      const setting = adminSvc.getSystemSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      res.json(setting);
    } catch (error) {
      console.error('Get setting error:', error);
      res.status(500).json({ error: 'Failed to get setting' });
    }
  });

  // PUT /api/admin/settings/:key - Update setting
  router.put('/settings/:key', (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;

      if (value === undefined) {
        return res.status(400).json({ error: 'Value is required' });
      }

      const setting = adminSvc.setSystemSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  });

  return router;
}

// Export default instance for backwards compatibility
export default createAdminRouter();

