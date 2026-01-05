import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';
import { adminService, AdminService } from '../services/admin';

// Helper to set no-cache headers (for dynamic data)
const noCache = (res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

// Helper to set short-lived cache headers (for semi-static data like services/staff)
const shortCache = (res: Response, seconds: number = 60) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
};


export function createServicesRouter(
  receptionist: ReceptionistService = new ReceptionistService(),
  adminSvc: AdminService = adminService
) {
  const router = Router();

  // GET /api/services - Get all services (from database)
  router.get('/', (req: Request, res: Response) => {
    try {
      shortCache(res, 60); // Cache for 60 seconds - services rarely change
      // Get active services from database
      const services = adminSvc.getAllServices(true);
      res.json(services);
    } catch (error) {
      console.error('Get services error:', error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  });

  // NOTE: Specific routes MUST come before /:id to avoid being caught by the wildcard

  // GET /api/services/staff - Get active staff members (public endpoint for booking)
  router.get('/staff', (req: Request, res: Response) => {
    try {
      shortCache(res, 60); // Cache for 60 seconds - staff rarely changes
      const staff = adminSvc.getAllStaff(true);
      res.json(staff);
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({ error: 'Failed to get staff' });
    }
  });

  // GET /api/services/business/info - Get business information
  router.get('/business/info', (req: Request, res: Response) => {
    try {
      noCache(res);
      const info = receptionist.getBusinessInfo();
      res.json(info);
    } catch (error) {
      console.error('Get business info error:', error);
      res.status(500).json({ error: 'Failed to get business info' });
    }
  });

  // GET /api/services/business/hours - Get business hours
  router.get('/business/hours', (req: Request, res: Response) => {
    try {
      noCache(res);
      const hours = receptionist.getBusinessHours();
      res.json(hours);
    } catch (error) {
      console.error('Get hours error:', error);
      res.status(500).json({ error: 'Failed to get business hours' });
    }
  });

  // GET /api/services/staff/:serviceId - Get staff members for a specific service
  router.get('/staff/:serviceId', (req: Request, res: Response) => {
    try {
      shortCache(res, 60); // Cache for 60 seconds - staff assignments rarely change
      const { serviceId } = req.params;

      // Get all active staff
      const allStaff = adminSvc.getAllStaff(true);

      // Filter to only staff who provide this service
      // A staff member provides a service if their services array includes the serviceId
      // OR if they have no services assigned (legacy: can do anything)
      const filteredStaff = allStaff.filter(s => {
        // If staff has no services assigned, they can do all services (backwards compatible)
        if (!s.services || s.services.length === 0) {
          return true;
        }
        // Otherwise, check if serviceId is in their services array
        return s.services.includes(serviceId);
      });

      res.json(filteredStaff);
    } catch (error) {
      console.error('Get staff by service error:', error);
      res.status(500).json({ error: 'Failed to get staff' });
    }
  });

  // GET /api/services/:id - Get a specific service (MUST be last - catches all)
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const service = adminSvc.getService(id);

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

// Export default instance for backwards compatibility
export default createServicesRouter();
