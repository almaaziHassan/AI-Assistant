import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';
import { adminService } from '../services/admin';

const router = Router();
const receptionist = new ReceptionistService();

// Helper to set no-cache headers
const noCache = (res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

// GET /api/services - Get all services
router.get('/', (req: Request, res: Response) => {
  try {
    noCache(res);
    const services = receptionist.getServices();
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
    noCache(res);
    console.log('[services/staff] Fetching active staff');
    const staff = adminService.getAllStaff(true);
    console.log(`[services/staff] Returning ${staff.length} staff members`);
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

// GET /api/services/:id - Get a specific service (MUST be last - catches all)
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const services = receptionist.getServices();
    const service = services.find(s => s.id === id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Failed to get service' });
  }
});

export default router;
