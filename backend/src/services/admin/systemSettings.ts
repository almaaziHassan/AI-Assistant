import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, SqlValue } from '../../db/database';
import { FAQ, SystemSetting } from './types';

// ============ FAQ MANAGEMENT ============

function rowToFAQ(row: Record<string, unknown>): FAQ {
    let keywords: string[] = [];
    if (row.keywords) {
        if (typeof row.keywords === 'string') {
            try {
                keywords = JSON.parse(row.keywords);
            } catch {
                keywords = [];
            }
        } else if (Array.isArray(row.keywords)) {
            keywords = row.keywords as string[];
        }
    }

    return {
        id: row.id as string,
        question: row.question as string,
        answer: row.answer as string,
        keywords,
        displayOrder: (row.display_order as number) || 0,
        isActive: row.is_active === true || row.is_active === 1,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
    };
}

export function createFAQ(data: Omit<FAQ, 'id' | 'createdAt' | 'updatedAt'>): FAQ {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next display order if not provided
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
        const maxOrderResult = getOne('SELECT MAX(display_order) as max_order FROM faqs');
        displayOrder = ((maxOrderResult?.max_order as number) || 0) + 1;
    }

    runQuery(
        `INSERT INTO faqs(id, question, answer, keywords, display_order, is_active, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.question, data.answer, JSON.stringify(data.keywords || []),
            displayOrder, data.isActive ? 1 : 0, now, now]
    );

    return { id, ...data, displayOrder, createdAt: now, updatedAt: now };
}

export function getFAQ(id: string): FAQ | null {
    const row = getOne('SELECT * FROM faqs WHERE id = ?', [id]);
    return row ? rowToFAQ(row) : null;
}

export function getAllFAQs(activeOnly: boolean = false): FAQ[] {
    const query = activeOnly
        ? 'SELECT * FROM faqs WHERE is_active = true ORDER BY display_order, created_at'
        : 'SELECT * FROM faqs ORDER BY display_order, created_at';
    return getAll(query).map(rowToFAQ);
}

export function updateFAQ(id: string, data: Partial<Omit<FAQ, 'id' | 'createdAt' | 'updatedAt'>>): FAQ | null {
    const existing = getFAQ(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: SqlValue[] = [];
    const now = new Date().toISOString();

    if (data.question !== undefined) { updates.push('question = ?'); values.push(data.question); }
    if (data.answer !== undefined) { updates.push('answer = ?'); values.push(data.answer); }
    if (data.keywords !== undefined) { updates.push('keywords = ?'); values.push(JSON.stringify(data.keywords)); }
    if (data.displayOrder !== undefined) { updates.push('display_order = ?'); values.push(data.displayOrder); }
    if (data.isActive !== undefined) { updates.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    updates.push('updated_at = ?');
    values.push(now);

    if (updates.length > 0) {
        values.push(id);
        runQuery(`UPDATE faqs SET ${updates.join(', ')} WHERE id = ? `, values);
    }

    return getFAQ(id);
}

export function deleteFAQ(id: string): boolean {
    const existing = getFAQ(id);
    if (!existing) return false;
    runQuery('DELETE FROM faqs WHERE id = ?', [id]);
    return true;
}

// ============ SYSTEM SETTINGS MANAGEMENT ============

function rowToSystemSetting(row: Record<string, unknown>): SystemSetting {
    let value: any = null;
    if (row.value) {
        if (typeof row.value === 'string') {
            try {
                value = JSON.parse(row.value);
            } catch {
                value = row.value;
            }
        } else {
            value = row.value;
        }
    }

    return {
        key: row.key as string,
        value,
        description: row.description as string | undefined,
        updatedAt: row.updated_at as string
    };
}

export function getSystemSetting(key: string): SystemSetting | null {
    const row = getOne('SELECT * FROM system_settings WHERE key = ?', [key]);
    return row ? rowToSystemSetting(row) : null;
}

export function getAllSystemSettings(): SystemSetting[] {
    return getAll('SELECT * FROM system_settings ORDER BY key').map(rowToSystemSetting);
}

export function setSystemSetting(key: string, value: any, description?: string): SystemSetting {
    const now = new Date().toISOString();
    const existing = getSystemSetting(key);
    const jsonValue = JSON.stringify(value);

    if (existing) {
        const updates: string[] = ['value = ?', 'updated_at = ?'];
        const values: SqlValue[] = [jsonValue, now];

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }

        values.push(key);
        runQuery(`UPDATE system_settings SET ${updates.join(', ')} WHERE key = ?`, values);
    } else {
        runQuery(
            `INSERT INTO system_settings(key, value, description, updated_at) VALUES(?, ?, ?, ?)`,
            [key, jsonValue, description || null, now]
        );
    }

    return { key, value, description: description || existing?.description, updatedAt: now };
}
