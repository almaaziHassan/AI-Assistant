import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, SqlValue } from '../../db/database';
import { Location } from './types';

function rowToLocation(row: Record<string, unknown>): Location {
    return {
        id: row.id as string,
        name: row.name as string,
        address: row.address as string | undefined,
        phone: row.phone as string | undefined,
        isActive: row.is_active === true || row.is_active === 1,
        createdAt: row.created_at as string
    };
}

export function createLocation(data: Omit<Location, 'id' | 'createdAt'>): Location {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
        `INSERT INTO locations(id, name, address, phone, is_active, created_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.address || null, data.phone || null, data.isActive ? 1 : 0, now]
    );

    return { id, ...data, createdAt: now };
}

export function getLocation(id: string): Location | null {
    const row = getOne('SELECT * FROM locations WHERE id = ?', [id]);
    return row ? rowToLocation(row) : null;
}

export function getAllLocations(activeOnly: boolean = false): Location[] {
    const query = activeOnly
        ? 'SELECT * FROM locations WHERE is_active = true ORDER BY name'
        : 'SELECT * FROM locations ORDER BY name';
    return getAll(query).map(rowToLocation);
}

export function updateLocation(id: string, data: Partial<Omit<Location, 'id' | 'createdAt'>>): Location | null {
    const existing = getLocation(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.address !== undefined) { updates.push('address = ?'); values.push(data.address); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (updates.length > 0) {
        values.push(id);
        runQuery(`UPDATE locations SET ${updates.join(', ')} WHERE id = ? `, values);
    }

    return getLocation(id);
}

export function deleteLocation(id: string): boolean {
    const existing = getLocation(id);
    if (!existing) return false;
    runQuery('DELETE FROM locations WHERE id = ?', [id]);
    return true;
}
