import { runQuery, getOne, getAll, SqlValue } from '../../db/database';
import { Service } from './types';

function rowToService(row: Record<string, unknown>): Service {
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

export function createService(data: Omit<Service, 'id' | 'createdAt'>): Service {
    const id = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const now = new Date().toISOString();

    // Get the next display order
    const maxOrderResult = getOne('SELECT MAX(display_order) as max_order FROM services');
    const nextOrder = ((maxOrderResult?.max_order as number) || 0) + 1;

    runQuery(
        `INSERT INTO services(id, name, description, duration, price, is_active, display_order, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, data.description || null, data.duration, data.price,
            data.isActive ? 1 : 0, data.displayOrder || nextOrder, now]
    );

    return { id, ...data, displayOrder: data.displayOrder || nextOrder, createdAt: now };
}

export function getService(id: string): Service | null {
    const row = getOne('SELECT * FROM services WHERE id = ?', [id]);
    return row ? rowToService(row) : null;
}

export function getAllServices(activeOnly: boolean = false): Service[] {
    const query = activeOnly
        ? 'SELECT * FROM services WHERE is_active = true ORDER BY display_order, name'
        : 'SELECT * FROM services ORDER BY display_order, name';
    return getAll(query).map(rowToService);
}

export function updateService(id: string, data: Partial<Omit<Service, 'id' | 'createdAt'>>): Service | null {
    const existing = getService(id);
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
        runQuery(`UPDATE services SET ${updates.join(', ')} WHERE id = ? `, values);
    }

    return getService(id);
}

export function deleteService(id: string): boolean {
    const existing = getService(id);
    if (!existing) return false;
    runQuery('DELETE FROM services WHERE id = ?', [id]);
    return true;
}
