import { getDatabaseMode, getDbSync, saveDatabase, runQueryAsync, getOneAsync } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
    console.log('Checking if database needs seeding...');

    const dbMode = getDatabaseMode();

    if (dbMode === 'postgres') {
        await seedPostgres();
    } else {
        seedSqlite();
    }
}

async function seedPostgres() {
    // Check if we already have valid staff
    const hasStaff = await getOneAsync('SELECT * FROM staff LIMIT 1');

    if (hasStaff) {
        console.log('Database already has valid data, skipping seed.');
        return;
    }

    console.log('Database is empty, seeding with default data...');

    try {
        // Add default staff member (without services column - now uses junction table)
        const staffId = uuidv4();
        await runQueryAsync(
            `INSERT INTO staff (id, name, email, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [staffId, 'Available Staff', null, 'Therapist', true, new Date().toISOString()]
        );

        console.log('✅ Default staff member added');
        console.log('✅ Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

function seedSqlite() {
    const db = getDbSync();

    // Check if we already have valid staff
    const stmt = db.prepare('SELECT * FROM staff LIMIT 1');
    const hasStaff = stmt.step();
    stmt.free();

    if (hasStaff) {
        console.log('Database already has valid data, skipping seed.');
        return;
    }

    console.log('Database is empty, seeding with default data...');

    try {
        // Add default staff member (SQLite still has services column for backward compat)
        const staffId = uuidv4();
        db.run(
            `INSERT INTO staff (id, name, email, role, services, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [staffId, 'Available Staff', null, 'Therapist', '[]', 1, new Date().toISOString()]
        );

        console.log('✅ Default staff member added');

        // Save after changes
        saveDatabase();

        console.log('✅ Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}
