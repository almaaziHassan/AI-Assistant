import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, SqlValue } from '../../db/database';
import { Staff, WeeklySchedule } from './types';

function parseSchedule(data: unknown): WeeklySchedule | undefined {
    if (!data) return undefined;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch {
            return undefined;
        }
    }
    return data as WeeklySchedule;
}

function rowToStaff(row: Record<string, unknown>): Staff {
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
        schedule: parseSchedule(row.schedule),
        color: row.color as string | undefined,
        isActive: row.is_active === true || row.is_active === 1,
        createdAt: row.created_at as string
    };
}

export function createStaff(data: Omit<Staff, 'id' | 'createdAt'>): Staff {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
        `INSERT INTO staff(id, name, email, phone, role, services, schedule, color, is_active, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.email || null, data.phone || null, data.role,
            JSON.stringify(data.services), data.schedule ? JSON.stringify(data.schedule) : null,
            data.color || null, data.isActive ? 1 : 0, now]
    );

    return { id, ...data, createdAt: now };
}

export function getStaff(id: string): Staff | null {
    const row = getOne('SELECT * FROM staff WHERE id = ?', [id]);
    return row ? rowToStaff(row) : null;
}

export function getAllStaff(activeOnly: boolean = false): Staff[] {
    const query = activeOnly
        ? 'SELECT * FROM staff WHERE is_active = true ORDER BY name'
        : 'SELECT * FROM staff ORDER BY name';
    return getAll(query).map(rowToStaff);
}

export function updateStaff(id: string, data: Partial<Omit<Staff, 'id' | 'createdAt'>>): Staff | null {
    const existing = getStaff(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }
    if (data.services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(data.services)); }
    if (data.schedule !== undefined) { updates.push('schedule = ?'); values.push(data.schedule ? JSON.stringify(data.schedule) : null); }
    if (data.color !== undefined) { updates.push('color = ?'); values.push(data.color); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (updates.length > 0) {
        values.push(id);
        runQuery(`UPDATE staff SET ${updates.join(', ')} WHERE id = ? `, values);
    }

    return getStaff(id);
}

export function deleteStaff(id: string): boolean {
    const existing = getStaff(id);
    if (!existing) return false;
    runQuery('DELETE FROM staff WHERE id = ?', [id]);
    return true;
}
