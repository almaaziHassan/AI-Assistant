import { Request, Response, NextFunction } from 'express';

// Sanitize string inputs to prevent XSS and injection attacks
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
        .substring(0, 500); // Limit length to prevent DoS via large inputs
}

// Validate and sanitize email
export function validateEmail(email: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid email format' };
    }

    if (sanitized.length > 254) {
        return { valid: false, sanitized, error: 'Email too long' };
    }

    return { valid: true, sanitized };
}

// Validate phone number (flexible international format)
export function validatePhone(phone: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = phone.replace(/[^\d+\-()\s]/g, '').trim();

    if (sanitized.length < 10 || sanitized.length > 20) {
        return { valid: false, sanitized, error: 'Phone number must be 10-20 characters' };
    }

    return { valid: true, sanitized };
}

// Validate date (YYYY-MM-DD)
export function validateDate(date: string): { valid: boolean; error?: string } {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(date)) {
        return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        return { valid: false, error: 'Invalid date' };
    }

    return { valid: true };
}

// Validate time (HH:MM)
export function validateTime(time: string): { valid: boolean; error?: string } {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(time)) {
        return { valid: false, error: 'Invalid time format. Use HH:MM (24-hour)' };
    }

    return { valid: true };
}

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

    if (password.length > 100) {
        return res.status(400).json({ error: 'Password too long' });
    }

    next();
}
