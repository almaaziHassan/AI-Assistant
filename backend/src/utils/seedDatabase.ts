```typescript
import { getDbSync, saveDatabase } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  console.log('Checking if database needs seeding...');

  const db = getDbSync();

  // Check if we already have staff
  const stmt = db.prepare('SELECT * FROM staff LIMIT 1');
  const hasStaff = stmt.step();
  stmt.free();
  
  if (hasStaff) {
    console.log('Database already has data, skipping seed.');
    return;
  }

  console.log('Database is empty, seeding with default data...');

  try {
    // Add default staff member
    const staffId = uuidv4();
    db.run(
      `INSERT INTO staff(id, name, email, role, services, is_active, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [staffId, 'Available Staff', null, 'Therapist', 'all', 1, new Date().toISOString()]
    );

    console.log('✅ Default staff member added');

    // Save after changes
    saveDatabase();
    
    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
```
