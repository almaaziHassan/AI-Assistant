/**
 * Services Routes - Prisma Implementation
 * 
 * Public API routes for services, staff, and business info.
 */

import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';
import { adminServicePrisma, AdminServicePrisma } from '../services/adminPrisma';

// Helper to set short-lived cache headers
const shortCache = (res: Response, seconds: number = 60) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
};

export function createServicesRouterPrisma(
    receptionist: ReceptionistService = new ReceptionistService(),
    adminSvc: AdminServicePrisma = adminServicePrisma
) {
    const router = Router();

    // GET /api/services - Get all services (from database)
    router.get('/', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            const services = await adminSvc.getAllServices(true);
            res.json(services);
        } catch (error) {
            console.error('Get services error:', error);
            res.status(500).json({ error: 'Failed to get services' });
        }
    });

    // GET /api/services/staff - Get active staff members (public endpoint for booking)
    router.get('/staff', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            console.log('[services/staff] Fetching active staff');
            const staff = await adminSvc.getAllStaff(true);
            console.log(`[services/staff] Returning ${staff.length} staff members`);

            // Sanitize sensitive info for public endpoint
            const sanitizedStaff = staff.map(s => ({
                id: s.id,
                name: s.name,
                role: s.role,
                services: s.services,
                color: s.color,
                isActive: s.isActive
            }));

            res.json(sanitizedStaff);
        } catch (error) {
            console.error('Get staff error:', error);
            res.status(500).json({ error: 'Failed to get staff' });
        }
    });

    // GET /api/services/business/info - Get business information
    router.get('/business/info', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            const info = await receptionist.getBusinessInfo();
            res.json(info);
        } catch (error) {
            console.error('Get business info error:', error);
            res.status(500).json({ error: 'Failed to get business info' });
        }
    });

    // GET /api/services/business/hours - Get business hours
    router.get('/business/hours', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            const hours = await receptionist.getBusinessHours();
            res.json(hours);
        } catch (error) {
            console.error('Get hours error:', error);
            res.status(500).json({ error: 'Failed to get business hours' });
        }
    });

    // GET /api/services/staff/:serviceId - Get staff members for a specific service
    router.get('/staff/:serviceId', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            const { serviceId } = req.params;
            console.log(`[services/staff/:serviceId] Fetching staff for service: ${serviceId}`);

            const allStaff = await adminSvc.getAllStaff(true);

            // Filter to only staff who provide this service
            const filteredStaff = allStaff.filter(s => {
                const services = s.services as string[] | null;
                if (!services || services.length === 0) {
                    return true; // Legacy: staff with no services can do all
                }
                return services.includes(serviceId);
            });

            console.log(`[services/staff/:serviceId] Found ${filteredStaff.length} staff for service ${serviceId}`);
            res.json(filteredStaff);
        } catch (error) {
            console.error('Get staff by service error:', error);
            res.status(500).json({ error: 'Failed to get staff' });
        }
    });

    // GET /api/services/:id - Get a specific service
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            shortCache(res);
            const { id } = req.params;
            const service = await adminSvc.getService(id);

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            res.json(service);
        } catch (error) {
            console.error('Get service error:', error);
            res.status(500).json({ error: 'Failed to get service' });
        }
    });

    return router;
}

export default createServicesRouterPrisma();
