import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/receptionist.db');
let db: SqlJsDatabase | null = null;
let dbInitialized = false;

async function ensureDataDir(): Promise<void> {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  await ensureDataDir();
  const SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

export function getDbSync(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  if (dbInitialized) return;

  const database = await getDb();

  // Create appointments table
  database.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      staff_id TEXT,
      staff_name TEXT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT DEFAULT 'confirmed',
      location_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_appointments_date
    ON appointments(appointment_date)
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_appointments_email
    ON appointments(customer_email)
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_appointments_staff
    ON appointments(staff_id)
  `);

  // Conversations table
  database.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      action_type TEXT,
      action_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_conversations_session
    ON conversations(session_id)
  `);

  // Migration: Add new columns if they don't exist (for existing databases)
  try {
    database.run(`ALTER TABLE conversations ADD COLUMN message_type TEXT DEFAULT 'text'`);
  } catch { /* Column already exists */ }
  try {
    database.run(`ALTER TABLE conversations ADD COLUMN action_type TEXT`);
  } catch { /* Column already exists */ }
  try {
    database.run(`ALTER TABLE conversations ADD COLUMN action_data TEXT`);
  } catch { /* Column already exists */ }

  // Waitlist table
  database.run(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service_id TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT,
      staff_id TEXT,
      status TEXT DEFAULT 'waiting',
      notified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_waitlist_date
    ON waitlist(preferred_date)
  `);

  // Holidays table
  database.run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_closed INTEGER DEFAULT 1,
      custom_hours_open TEXT,
      custom_hours_close TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Staff table
  database.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT DEFAULT 'staff',
      services TEXT,
      color TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Locations table
  database.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Callback requests table
  database.run(`
    CREATE TABLE IF NOT EXISTS callbacks (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      preferred_time TEXT,
      concerns TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      called_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_callbacks_status
    ON callbacks(status)
  `);

  // Save the database
  saveDatabase();

  dbInitialized = true;
  console.log('Database initialized successfully');
}

export function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// Type for SQL values
export type SqlValue = string | number | null | Uint8Array;

// Helper functions for compatibility
export function runQuery(sql: string, params: SqlValue[] = []): void {
  const database = getDbSync();
  database.run(sql, params);
  saveDatabase();
}

export function getOne(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  const database = getDbSync();
  const stmt = database.prepare(sql);
  stmt.bind(params);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as Record<string, unknown>;
  }

  stmt.free();
  return undefined;
}

export function getAll(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  const database = getDbSync();
  const stmt = database.prepare(sql);
  stmt.bind(params);

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }

  stmt.free();
  return results;
}
