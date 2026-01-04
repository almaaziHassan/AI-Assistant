import { Request, Response, NextFunction } from 'express';
import {
    sanitizeString,
    validateEmail,
    validatePhone,
    validateDate,
    validateTime
} from '../utils/validators';
import { VALIDATION_LIMITS, VALIDATION_MESSAGES } from '../constants/validation';

// Middleware: Validate booking request
export function validateBookingRequest(req: Request, res: Response, next: NextFunction) {
    const { customerName, customerEmail, customerPhone, serviceId, date, time, staffId, notes } = req.body;

    // Required fields
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
        return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!customerEmail || typeof customerEmail !== 'string') {
        return res.status(400).json({ error: 'Customer email is required' });
    }

    if (!customerPhone || typeof customerPhone !== 'string') {
        return res.status(400).json({ error: 'Customer phone is required' });
    }

    if (!serviceId || typeof serviceId !== 'string') {
        return res.status(400).json({ error: 'Service ID is required' });
    }

    if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: 'Date is required' });
    }

    if (!time || typeof time !== 'string') {
        return res.status(400).json({ error: 'Time is required' });
    }

    // Validate and sanitize
    const emailValidation = validateEmail(customerEmail);
    if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
    }

    const phoneValidation = validatePhone(customerPhone);
    if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
    }

    const dateValidation = validateDate(date);
    if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
    }

    const timeValidation = validateTime(time);
    if (!timeValidation.valid) {
        return res.status(400).json({ error: timeValidation.error });
    }

    // Sanitize inputs
    req.body.customerName = sanitizeString(customerName);
    req.body.customerEmail = emailValidation.sanitized;
    req.body.customerPhone = phoneValidation.sanitized;
    req.body.serviceId = sanitizeString(serviceId);
    req.body.date = date.trim();
    req.body.time = time.trim();

    if (staffId && typeof staffId === 'string') {
        req.body.staffId = sanitizeString(staffId);
    }

    if (notes && typeof notes === 'string') {
        req.body.notes = sanitizeString(notes);
    }

    next();
}

// Middleware: Validate admin login
export function validateAdminLogin(req: Request, res: Response, next: NextFunction) {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length > VALIDATION_LIMITS.PASSWORD.MAX_LENGTH) {
        return res.status(400).json({
            error: VALIDATION_MESSAGES.PASSWORD_TOO_LONG(VALIDATION_LIMITS.PASSWORD.MAX_LENGTH)
        });
    }

    next();
}

