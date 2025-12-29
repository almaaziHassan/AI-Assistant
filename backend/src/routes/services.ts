import { Router, Request, Response } from 'express';
import { ReceptionistService } from '../services/receptionist';
import { adminService } from '../services/admin';

const router = Router();
const receptionist = new ReceptionistService();

// GET /api/services - Get all services
router.get('/', (req: Request, res: Response) => {
  try {
    const services = receptionist.getServices();
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

// GET /api/services/:id - Get a specific service
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

// GET /api/services/business/info - Get business information
router.get('/business/info', (req: Request, res: Response) => {
  try {
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
    const hours = receptionist.getBusinessHours();
    res.json(hours);
  } catch (error) {
    console.error('Get hours error:', error);
    res.status(500).json({ error: 'Failed to get business hours' });
  }
});

// GET /api/services/staff - Get active staff members (public endpoint for booking)
router.get('/staff', (req: Request, res: Response) => {
  try {
    // Only return active staff members for public booking
    const staff = adminService.getAllStaff(true);
    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to get staff' });
  }
});

export default router;
