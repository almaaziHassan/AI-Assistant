import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, SqlValue } from '../../db/database';
import { Holiday } from './types';

function rowToHoliday(row: Record<string, unknown>): Holiday {
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

export function createHoliday(data: Omit<Holiday, 'id' | 'createdAt'>): Holiday {
    const id = uuidv4();
    const now = new Date().toISOString();

    runQuery(
        `INSERT INTO holidays(id, date, name, is_closed, custom_hours_open, custom_hours_close, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [id, data.date, data.name, data.isClosed ? 1 : 0,
            data.customHoursOpen || null, data.customHoursClose || null, now]
    );

    return { id, ...data, createdAt: now };
}

export function getHoliday(id: string): Holiday | null {
    const row = getOne('SELECT * FROM holidays WHERE id = ?', [id]);
    return row ? rowToHoliday(row) : null;
}

export function getHolidayByDate(date: string): Holiday | null {
    const row = getOne('SELECT * FROM holidays WHERE date = ?', [date]);
    return row ? rowToHoliday(row) : null;
}

export function getAllHolidays(futureOnly: boolean = false): Holiday[] {
    const today = new Date().toISOString().split('T')[0];
    const query = futureOnly
        ? 'SELECT * FROM holidays WHERE date >= ? ORDER BY date'
        : 'SELECT * FROM holidays ORDER BY date';
    const params = futureOnly ? [today] : [];
    return getAll(query, params).map(rowToHoliday);
}

export function updateHoliday(id: string, data: Partial<Omit<Holiday, 'id' | 'createdAt'>>): Holiday | null {
    const existing = getHoliday(id);
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
        runQuery(`UPDATE holidays SET ${updates.join(', ')} WHERE id = ? `, values);
    }

    return getHoliday(id);
}

export function deleteHoliday(id: string): boolean {
    const existing = getHoliday(id);
    if (!existing) return false;
    runQuery('DELETE FROM holidays WHERE id = ?', [id]);
    return true;
}
