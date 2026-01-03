import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, SqlValue } from '../db/database';

// Staff interfaces
export interface Staff {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  services: string[]; // Array of service IDs this staff can provide
  color?: string;
  isActive: boolean;
  createdAt: string;
}

// Location interfaces
export interface Location {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

// Holiday interfaces
export interface Holiday {
  id: string;
  date: string;
  name: string;
  isClosed: boolean;
  customHoursOpen?: string;
  customHoursClose?: string;
  createdAt: string;
}


// Service interfaces
export interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

// Analytics interfaces
export interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  monthAppointments: number;
  totalRevenue: number;
  cancelledCount: number;
  upcomingCount: number;
  pendingCallbacksCount: number;
  topServices: { serviceId: string; serviceName: string; count: number }[];
}

export class AdminService {
  // ============ STAFF MANAGEMENT ============

  createStaff(data: Omit<Staff, 'id' | 'createdAt'>): Staff {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO staff (id, name, email, phone, role, services, color, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email || null, data.phone || null, data.role,
        JSON.stringify(data.services), data.color || null, data.isActive ? 1 : 0, now]
    );

    return { id, ...data, createdAt: now };
  }

  getStaff(id: string): Staff | null {
    const row = getOne('SELECT * FROM staff WHERE id = ?', [id]);
    return row ? this.rowToStaff(row) : null;
  }

  getAllStaff(activeOnly: boolean = false): Staff[] {
    const query = activeOnly
      ? 'SELECT * FROM staff WHERE is_active = true ORDER BY name'
      : 'SELECT * FROM staff ORDER BY name';
    return getAll(query).map(row => this.rowToStaff(row));
  }

  updateStaff(id: string, data: Partial<Omit<Staff, 'id' | 'createdAt'>>): Staff | null {
    const existing = this.getStaff(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }
    if (data.services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(data.services)); }
    if (data.color !== undefined) { updates.push('color = ?'); values.push(data.color); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (updates.length > 0) {
      values.push(id);
      runQuery(`UPDATE staff SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getStaff(id);
  }

  deleteStaff(id: string): boolean {
    const existing = this.getStaff(id);
    if (!existing) return false;
    runQuery('DELETE FROM staff WHERE id = ?', [id]);
    return true;
  }

  private rowToStaff(row: Record<string, unknown>): Staff {
    // Handle services field: PostgreSQL JSONB returns as object, SQLite TEXT needs parsing
    let services: string[] = [];
    if (row.services) {
      if (typeof row.services === 'string') {
        // SQLite: stored as JSON string
        try {
          services = JSON.parse(row.services);
        } catch {
          services = [];
        }
      } else if (Array.isArray(row.services)) {
        // PostgreSQL JSONB: already parsed as array
        services = row.services as string[];
      }
    }

    return {
      id: row.id as string,
      name: row.name as string,
      email: row.email as string | undefined,
      phone: row.phone as string | undefined,
      role: row.role as string,
      services,
      color: row.color as string | undefined,
      isActive: row.is_active === true || row.is_active === 1,
      createdAt: row.created_at as string
    };
  }

  // ============ LOCATION MANAGEMENT ============

  createLocation(data: Omit<Location, 'id' | 'createdAt'>): Location {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO locations (id, name, address, phone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.address || null, data.phone || null, data.isActive ? 1 : 0, now]
    );

    return { id, ...data, createdAt: now };
  }

  getLocation(id: string): Location | null {
    const row = getOne('SELECT * FROM locations WHERE id = ?', [id]);
    return row ? this.rowToLocation(row) : null;
  }

  getAllLocations(activeOnly: boolean = false): Location[] {
    const query = activeOnly
      ? 'SELECT * FROM locations WHERE is_active = true ORDER BY name'
      : 'SELECT * FROM locations ORDER BY name';
    return getAll(query).map(row => this.rowToLocation(row));
  }

  updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'createdAt'>>): Location | null {
    const existing = this.getLocation(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.address !== undefined) { updates.push('address = ?'); values.push(data.address); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (updates.length > 0) {
      values.push(id);
      runQuery(`UPDATE locations SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getLocation(id);
  }

  deleteLocation(id: string): boolean {
    const existing = this.getLocation(id);
    if (!existing) return false;
    runQuery('DELETE FROM locations WHERE id = ?', [id]);
    return true;
  }

  private rowToLocation(row: Record<string, unknown>): Location {
    return {
      id: row.id as string,
      name: row.name as string,
      address: row.address as string | undefined,
      phone: row.phone as string | undefined,
      isActive: row.is_active === true || row.is_active === 1,
      createdAt: row.created_at as string
    };
  }

  // ============ SERVICE MANAGEMENT ============

  createService(data: Omit<Service, 'id' | 'createdAt'>): Service {
    const id = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const now = new Date().toISOString();

    // Get the next display order
    const maxOrderResult = getOne('SELECT MAX(display_order) as max_order FROM services');
    const nextOrder = ((maxOrderResult?.max_order as number) || 0) + 1;

    runQuery(
      `INSERT INTO services (id, name, description, duration, price, is_active, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description || null, data.duration, data.price,
        data.isActive ? 1 : 0, data.displayOrder || nextOrder, now]
    );

    return { id, ...data, displayOrder: data.displayOrder || nextOrder, createdAt: now };
  }

  getService(id: string): Service | null {
    const row = getOne('SELECT * FROM services WHERE id = ?', [id]);
    return row ? this.rowToService(row) : null;
  }

  getAllServices(activeOnly: boolean = false): Service[] {
    const query = activeOnly
      ? 'SELECT * FROM services WHERE is_active = true ORDER BY display_order, name'
      : 'SELECT * FROM services ORDER BY display_order, name';
    return getAll(query).map(row => this.rowToService(row));
  }

  updateService(id: string, data: Partial<Omit<Service, 'id' | 'createdAt'>>): Service | null {
    const existing = this.getService(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.duration !== undefined) { updates.push('duration = ?'); values.push(data.duration); }
    if (data.price !== undefined) { updates.push('price = ?'); values.push(data.price); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (data.displayOrder !== undefined) { updates.push('display_order = ?'); values.push(data.displayOrder); }

    if (updates.length > 0) {
      values.push(id);
      runQuery(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getService(id);
  }

  deleteService(id: string): boolean {
    const existing = this.getService(id);
    if (!existing) return false;
    runQuery('DELETE FROM services WHERE id = ?', [id]);
    return true;
  }

  private rowToService(row: Record<string, unknown>): Service {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      duration: row.duration as number,
      price: Number(row.price) || 0,
      isActive: row.is_active === true || row.is_active === 1,
      displayOrder: (row.display_order as number) || 0,
      createdAt: row.created_at as string
    };
  }

  // ============ HOLIDAY MANAGEMENT ============

  createHoliday(data: Omit<Holiday, 'id' | 'createdAt'>): Holiday {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO holidays (id, date, name, is_closed, custom_hours_open, custom_hours_close, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.date, data.name, data.isClosed ? 1 : 0,
        data.customHoursOpen || null, data.customHoursClose || null, now]
    );

    return { id, ...data, createdAt: now };
  }

  getHoliday(id: string): Holiday | null {
    const row = getOne('SELECT * FROM holidays WHERE id = ?', [id]);
    return row ? this.rowToHoliday(row) : null;
  }

  getHolidayByDate(date: string): Holiday | null {
    const row = getOne('SELECT * FROM holidays WHERE date = ?', [date]);
    return row ? this.rowToHoliday(row) : null;
  }

  getAllHolidays(futureOnly: boolean = false): Holiday[] {
    const today = new Date().toISOString().split('T')[0];
    const query = futureOnly
      ? 'SELECT * FROM holidays WHERE date >= ? ORDER BY date'
      : 'SELECT * FROM holidays ORDER BY date';
    const params = futureOnly ? [today] : [];
    return getAll(query, params).map(row => this.rowToHoliday(row));
  }

  updateHoliday(id: string, data: Partial<Omit<Holiday, 'id' | 'createdAt'>>): Holiday | null {
    const existing = this.getHoliday(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.date !== undefined) { updates.push('date = ?'); values.push(data.date); }
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.isClosed !== undefined) { updates.push('is_closed = ?'); values.push(data.isClosed); }
    if (data.customHoursOpen !== undefined) { updates.push('custom_hours_open = ?'); values.push(data.customHoursOpen); }
    if (data.customHoursClose !== undefined) { updates.push('custom_hours_close = ?'); values.push(data.customHoursClose); }

    if (updates.length > 0) {
      values.push(id);
      runQuery(`UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getHoliday(id);
  }

  deleteHoliday(id: string): boolean {
    const existing = this.getHoliday(id);
    if (!existing) return false;
    runQuery('DELETE FROM holidays WHERE id = ?', [id]);
    return true;
  }

  private rowToHoliday(row: Record<string, unknown>): Holiday {
    return {
      id: row.id as string,
      date: row.date as string,
      name: row.name as string,
      isClosed: row.is_closed === true || row.is_closed === 1,
      customHoursOpen: row.custom_hours_open as string | undefined,
      customHoursClose: row.custom_hours_close as string | undefined,
      createdAt: row.created_at as string
    };
  }



  // ============ ANALYTICS & DASHBOARD ============

  getDashboardStats(): DashboardStats {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Today's appointments (confirmed + completed)
    const todayResult = getOne(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status IN ('confirmed', 'completed')`,
      [today]
    );
    const todayAppointments = (todayResult?.count as number) || 0;

    // Week appointments (confirmed + completed)
    const weekResult = getOne(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date >= ? AND status IN ('confirmed', 'completed')`,
      [weekAgo]
    );
    const weekAppointments = (weekResult?.count as number) || 0;

    // Month appointments (confirmed + completed)
    const monthResult = getOne(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date >= ? AND status IN ('confirmed', 'completed')`,
      [monthAgo]
    );
    const monthAppointments = (monthResult?.count as number) || 0;

    // Cancelled count (last 30 days)
    const cancelledResult = getOne(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date >= ? AND status = 'cancelled'`,
      [monthAgo]
    );
    const cancelledCount = (cancelledResult?.count as number) || 0;

    // Upcoming appointments - truly in the future (date > today, OR date = today AND time > now)
    // Use business timezone (UTC+5 for PKT) to correctly compare times
    const nowUTC = new Date();
    const businessOffset = 5 * 60; // PKT is UTC+5 (in minutes)
    const businessTime = new Date(nowUTC.getTime() + businessOffset * 60 * 1000);
    const businessDate = businessTime.toISOString().split('T')[0];
    const currentTime = businessTime.toTimeString().slice(0, 5); // HH:MM format in business timezone

    const upcomingResult = getOne(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE status IN ('pending', 'confirmed') 
       AND (appointment_date > ? OR (appointment_date = ? AND appointment_time > ?))`,
      [businessDate, businessDate, currentTime]
    );
    const upcomingCount = (upcomingResult?.count as number) || 0;



    // Pending callbacks count
    const callbacksResult = getOne(
      `SELECT COUNT(*) as count FROM callbacks WHERE status = 'pending'`
    );
    const pendingCallbacksCount = (callbacksResult?.count as number) || 0;

    // Top services
    const topServicesRows = getAll(
      `SELECT service_id, service_name, COUNT(*) as count
       FROM appointments
       WHERE appointment_date >= ?
       GROUP BY service_id, service_name
       ORDER BY count DESC
       LIMIT 5`,
      [monthAgo]
    );
    const topServices = topServicesRows.map(row => ({
      serviceId: row.service_id as string,
      serviceName: row.service_name as string,
      count: row.count as number
    }));

    // Total revenue (simplified - just count * average price)
    // In production, you'd want to store actual prices in appointments
    const totalRevenue = monthAppointments * 100; // Placeholder

    return {
      todayAppointments,
      weekAppointments,
      monthAppointments,
      totalRevenue,
      cancelledCount,
      upcomingCount,

      pendingCallbacksCount,
      topServices
    };
  }

  getAppointmentsForDateRange(startDate: string, endDate: string): Record<string, unknown>[] {
    return getAll(
      `SELECT * FROM appointments
       WHERE appointment_date >= ? AND appointment_date <= ?
       ORDER BY appointment_date, appointment_time`,
      [startDate, endDate]
    );
  }

  getAllAppointments(options: { status?: string; limit?: number; offset?: number } = {}): Record<string, unknown>[] {
    let query = 'SELECT * FROM appointments';
    const params: SqlValue[] = [];

    if (options.status) {
      query += ' WHERE status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY appointment_date ASC, appointment_time ASC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return getAll(query, params);
  }
}

export const adminService = new AdminService();
