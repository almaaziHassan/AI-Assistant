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
        // 1. Create Default Services
        const service1Id = uuidv4();
        const service2Id = uuidv4();

        await runQueryAsync(
            `INSERT INTO services (id, name, description, duration, price, is_active, display_order)
             VALUES 
             ($1, $2, $3, $4, $5, $6, $7),
             ($8, $9, $10, $11, $12, $13, $14)`,
            [
                service1Id, 'General Consultation', 'Initial discussion about your needs', 30, 50.00, true, 1,
                service2Id, 'Deep Tissue Massage', 'Therapeutic massage for muscle relief', 60, 100.00, true, 2
            ]
        );
        console.log('✅ Default services added');

        // 2. Create Default Staff
        const staffId = uuidv4();
        // Note: We deliberately don't set 'services' JSON column as we use the junction table now
        await runQueryAsync(
            `INSERT INTO staff (id, name, email, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [staffId, 'Dr. Sarah Smith', 'sarah@example.com', 'Therapist', true, new Date().toISOString()]
        );
        console.log('✅ Default staff member added');

        // 3. Link Staff to Services
        await runQueryAsync(
            `INSERT INTO staff_services (staff_id, service_id)
             VALUES ($1, $2), ($1, $3)`,
            [staffId, service1Id, service2Id]
        );
        console.log('✅ Staff linked to services');

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
