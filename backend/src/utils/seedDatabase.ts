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

        // 4. Seed Knowledge Base (FAQs & Settings)
        const config = require('../config/services.json');

        // FAQs
        if (config.faqs && Array.isArray(config.faqs)) {
            let order = 1;
            for (const faq of config.faqs) {
                await runQueryAsync(
                    `INSERT INTO faqs (id, question, answer, keywords, display_order, is_active, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
                    [
                        uuidv4(),
                        faq.question,
                        faq.answer,
                        JSON.stringify(faq.keywords || []),
                        order++,
                        true,
                        new Date().toISOString()
                    ]
                );
            }
            console.log('✅ FAQs seeded');
        }

        // System Settings
        const settingsToSeed = [
            { key: 'industryKnowledge', desc: 'Common problems, benefits, and advice' },
            { key: 'business', desc: 'Business contact info and details' },
            { key: 'receptionist', desc: 'Virtual receptionist persona and messages' },
            { key: 'appointmentSettings', desc: 'Booking rules and constraints' },
            { key: 'hours', desc: 'Weekly opening hours' }
        ];

        for (const setting of settingsToSeed) {
            if (config[setting.key]) {
                await runQueryAsync(
                    `INSERT INTO system_settings (key, value, description, updated_at)
                     VALUES ($1, $2, $3, $4)`,
                    [
                        setting.key,
                        JSON.stringify(config[setting.key]),
                        setting.desc,
                        new Date().toISOString()
                    ]
                );
            }
        }
        console.log('✅ System settings seeded');

        console.log('✅ Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}

function seedSqlite() {
    const db = getDbSync();

    // Check if we already have valid staff and services
    const stmtStaff = db.prepare('SELECT * FROM staff LIMIT 1');
    const hasStaff = stmtStaff.step();
    stmtStaff.free();

    const stmtServices = db.prepare('SELECT * FROM services LIMIT 1');
    const hasServices = stmtServices.step();
    stmtServices.free();

    if (hasStaff && hasServices) {
        console.log('Database already has valid data, skipping seed.');
        return;
    }

    console.log('Database needs seeding...');

    try {
        // 1. Create Default Services if missing
        let service1Id = uuidv4();
        let service2Id = uuidv4();

        if (!hasServices) {
            db.run(
                `INSERT INTO services (id, name, description, duration, price, is_active, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [service1Id, 'General Consultation', 'Initial discussion about your needs', 30, 50.00, 1, 1]
            );
            db.run(
                `INSERT INTO services (id, name, description, duration, price, is_active, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [service2Id, 'Deep Tissue Massage', 'Therapeutic massage for muscle relief', 60, 100.00, 1, 2]
            );
            console.log('✅ Default services added');
        } else {
            // Retrieve existing service IDs for staff
            const s = db.prepare('SELECT id FROM services LIMIT 2');
            if (s.step()) service1Id = s.getAsObject().id as string;
            if (s.step()) service2Id = s.getAsObject().id as string;
            s.free();
        }

        // 2. Add default staff if missing
        if (!hasStaff) {
            const staffId = uuidv4();
            const servicesJson = JSON.stringify([service1Id, service2Id]);

            db.run(
                `INSERT INTO staff (id, name, email, role, services, is_active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [staffId, 'Available Staff', 'staff@example.com', 'Therapist', servicesJson, 1, new Date().toISOString()]
            );
            console.log('✅ Default staff member added');
        }

        // Save after changes
        saveDatabase();

        console.log('✅ Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
}
