/**
 * Admin Routes - Prisma Implementation
 * 
 * Enterprise-grade admin API routes using Prisma ORM.
 * All handlers are async and use proper error handling.
 */

import { Router, Request, Response } from 'express';
import { adminServicePrisma, AdminServicePrisma } from '../services/adminPrisma';
import prisma from '../db/prisma';

export function createAdminRouterPrisma(
    adminSvc: AdminServicePrisma = adminServicePrisma
) {
    const router = Router();

    // ============ DASHBOARD ============

    // GET /api/admin/dashboard - Get dashboard statistics
    router.get('/dashboard', async (req: Request, res: Response) => {
        try {
            const stats = await adminSvc.getDashboardStats();
            res.json(stats);
        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({ error: 'Failed to get dashboard stats' });
        }
    });

    // GET /api/admin/appointments - Get all appointments with pagination
    router.get('/appointments', async (req: Request, res: Response) => {
        try {
            const { status, limit, offset, startDate, endDate } = req.query;

            if (startDate && endDate) {
                const appointments = await adminSvc.getAppointmentsForDateRange(
                    new Date(startDate as string),
                    new Date(endDate as string)
                );
                return res.json(appointments);
            }

            const appointments = await adminSvc.getAllAppointments({
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
    router.get('/staff', async (req: Request, res: Response) => {
        try {
            const activeOnly = req.query.active === 'true';
            const staff = await adminSvc.getAllStaff(activeOnly);
            res.json(staff);
        } catch (error) {
            console.error('Get staff error:', error);
            res.status(500).json({ error: 'Failed to get staff' });
        }
    });

    // POST /api/admin/staff - Create new staff member
    router.post('/staff', async (req: Request, res: Response) => {
        try {
            const { name, email, phone, role, services, schedule, color, isActive } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const staff = await adminSvc.createStaff({
                name,
                email,
                phone,
                role: role || 'staff',
                services: services || [],
                schedule,
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
    router.put('/staff/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const staff = await adminSvc.updateStaff(id, req.body);

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
    router.delete('/staff/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const success = await adminSvc.deleteStaff(id);

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
    router.get('/services', async (req: Request, res: Response) => {
        try {
            const activeOnly = req.query.active === 'true';
            const services = await adminSvc.getAllServices(activeOnly);
            res.json(services);
        } catch (error) {
            console.error('Get services error:', error);
            res.status(500).json({ error: 'Failed to get services' });
        }
    });

    // GET /api/admin/services/:id - Get specific service
    router.get('/services/:id', async (req: Request, res: Response) => {
        try {
            const service = await adminSvc.getService(req.params.id);
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
    router.post('/services', async (req: Request, res: Response) => {
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

            const service = await adminSvc.createService({
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
    router.put('/services/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const service = await adminSvc.updateService(id, req.body);

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
    router.delete('/services/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const success = await adminSvc.deleteService(id);

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
    router.get('/locations', async (req: Request, res: Response) => {
        try {
            const activeOnly = req.query.active === 'true';
            const locations = await adminSvc.getAllLocations(activeOnly);
            res.json(locations);
        } catch (error) {
            console.error('Get locations error:', error);
            res.status(500).json({ error: 'Failed to get locations' });
        }
    });

    // POST /api/admin/locations - Create new location
    router.post('/locations', async (req: Request, res: Response) => {
        try {
            const { name, address, phone, isActive } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const location = await adminSvc.createLocation({
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

    // DELETE /api/admin/locations/:id - Delete location
    router.delete('/locations/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const success = await adminSvc.deleteLocation(id);

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
    router.get('/holidays', async (req: Request, res: Response) => {
        try {
            const futureOnly = req.query.future === 'true';
            const holidays = await adminSvc.getAllHolidays(futureOnly);
            res.json(holidays);
        } catch (error) {
            console.error('Get holidays error:', error);
            res.status(500).json({ error: 'Failed to get holidays' });
        }
    });

    // POST /api/admin/holidays - Create new holiday
    router.post('/holidays', async (req: Request, res: Response) => {
        try {
            const { date, name, isClosed, customHoursOpen, customHoursClose } = req.body;

            if (!date || !name) {
                return res.status(400).json({ error: 'Date and name are required' });
            }

            // Check if holiday already exists for this date
            const existing = await adminSvc.getHolidayByDate(new Date(date));
            if (existing) {
                return res.status(400).json({ error: 'A holiday already exists for this date' });
            }

            const holiday = await adminSvc.createHoliday({
                date: new Date(date),
                name,
                isClosed: isClosed !== false,
                customHoursOpen: customHoursOpen ? new Date(`1970-01-01T${customHoursOpen}`) : undefined,
                customHoursClose: customHoursClose ? new Date(`1970-01-01T${customHoursClose}`) : undefined
            });

            res.status(201).json(holiday);
        } catch (error) {
            console.error('Create holiday error:', error);
            res.status(500).json({ error: 'Failed to create holiday' });
        }
    });

    // DELETE /api/admin/holidays/:id - Delete holiday
    router.delete('/holidays/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const success = await adminSvc.deleteHoliday(id);

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

            // Update using Prisma directly
            const updated = await prisma.appointment.update({
                where: { id },
                data: {
                    appointmentDate: new Date(date),
                    appointmentTime: new Date(`1970-01-01T${time}`),
                    updatedAt: new Date()
                },
                include: {
                    staff: true,
                    location: true
                }
            });

            res.json(updated);
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Appointment not found' });
            }
            console.error('Reschedule error:', error);
            res.status(500).json({ error: 'Failed to reschedule appointment' });
        }
    });

    // PUT /api/admin/appointments/:id/cancel - Cancel appointment
    router.put('/appointments/:id/cancel', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const updated = await prisma.appointment.update({
                where: { id },
                data: { status: 'cancelled' }
            });

            res.json({ message: 'Appointment cancelled successfully', appointment: updated });
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Appointment not found' });
            }
            console.error('Cancel error:', error);
            res.status(500).json({ error: 'Failed to cancel appointment' });
        }
    });

    // PATCH /api/admin/appointments/:id/status - Update appointment status (used by frontend)
    router.patch('/appointments/:id/status', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }

            const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const updated = await prisma.appointment.update({
                where: { id },
                data: { status, updatedAt: new Date() }
            });

            res.json(updated);
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Appointment not found' });
            }
            console.error('Update status error:', error);
            res.status(500).json({ error: 'Failed to update appointment status' });
        }
    });

    return router;
}

// Export default instance
export default createAdminRouterPrisma();
