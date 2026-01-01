import { Pool } from 'pg';
import initSqlJs, { Database as SqlJsDatabase, BindParams } from 'sql.js';
import fs from 'fs';
import path from 'path';

// Type for SQL values (compatible with both pg and sql.js)
export type SqlValue = string | number | null | Uint8Array;

// Database connection mode
type DbMode = 'postgres' | 'sqlite';

// PostgreSQL pool
let pgPool: Pool | null = null;

// SQLite database (fallback for local dev)
const dbPath = path.join(__dirname, '../../data/receptionist.db');
let sqliteDb: SqlJsDatabase | null = null;

// Current mode
let dbMode: DbMode = 'sqlite';
let dbInitialized = false;

// Determine which database to use
function getDbMode(): DbMode {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.startsWith('postgres')) {
    return 'postgres';
  }
  return 'sqlite';
}

// Initialize PostgreSQL
async function initPostgres(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  pgPool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Supabase
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Test connection
  const client = await pgPool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connected successfully');
  } finally {
    client.release();
  }
}

// Initialize SQLite (for local development)
async function initSqlite(): Promise<void> {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqliteDb = new SQL.Database(buffer);
  } else {
    sqliteDb = new SQL.Database();
  }
}

// Create tables for PostgreSQL
async function createPostgresTables(): Promise<void> {
  if (!pgPool) return;

  const client = await pgPool.connect();
  try {
    // Appointments table
    await client.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(customer_email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id)`);

    // Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        action_type TEXT,
        action_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id)`);

    // Waitlist table
    await client.query(`
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
        notified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_waitlist_date ON waitlist(preferred_date)`);

    // Holidays table
    await client.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_closed INTEGER DEFAULT 1,
        custom_hours_open TEXT,
        custom_hours_close TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Staff table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT DEFAULT 'staff',
        services TEXT,
        color TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Locations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Callbacks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS callbacks (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        preferred_time TEXT,
        concerns TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        called_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks(status)`);
  } finally {
    client.release();
  }
}

// Create tables for SQLite
function createSqliteTables(): void {
  if (!sqliteDb) return;

  sqliteDb.run(`
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

  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`);
  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(customer_email)`);
  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id)`);

  sqliteDb.run(`
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

  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id)`);

  // Migration for existing databases
  try { sqliteDb.run(`ALTER TABLE conversations ADD COLUMN message_type TEXT DEFAULT 'text'`); } catch { }
  try { sqliteDb.run(`ALTER TABLE conversations ADD COLUMN action_type TEXT`); } catch { }
  try { sqliteDb.run(`ALTER TABLE conversations ADD COLUMN action_data TEXT`); } catch { }

  sqliteDb.run(`
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

  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_waitlist_date ON waitlist(preferred_date)`);

  sqliteDb.run(`
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

  sqliteDb.run(`
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

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqliteDb.run(`
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

  sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks(status)`);

  saveSqliteDatabase();
}

function saveSqliteDatabase(): void {
  if (sqliteDb) {
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Main initialization function
export async function initDatabase(): Promise<void> {
  if (dbInitialized) return;

  dbMode = getDbMode();
  console.log(`Database mode: ${dbMode.toUpperCase()}`);

  if (dbMode === 'postgres') {
    await initPostgres();
    await createPostgresTables();
  } else {
    await initSqlite();
    createSqliteTables();
  }

  dbInitialized = true;
  console.log('Database initialized successfully');

  // Seed with default data if empty
  const { seedDatabase } = await import('../utils/seedDatabase');
  await seedDatabase();
}

// Query execution functions
export function runQuery(sql: string, params: SqlValue[] = []): void {
  if (dbMode === 'postgres') {
    runQueryAsync(sql, params).catch(console.error);
  } else {
    if (!sqliteDb) throw new Error('Database not initialized');
    sqliteDb.run(sql, params);
    saveSqliteDatabase();
  }
}

export async function runQueryAsync(sql: string, params: SqlValue[] = []): Promise<void> {
  if (dbMode === 'postgres') {
    if (!pgPool) throw new Error('Database not initialized');
    // Convert ? placeholders to $1, $2, etc for PostgreSQL
    const pgSql = sql.replace(/\?/g, (_, i) => `$${params.slice(0, sql.indexOf('?')).length + 1}`);
    let paramIndex = 0;
    const convertedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    await pgPool.query(convertedSql, params);
  } else {
    if (!sqliteDb) throw new Error('Database not initialized');
    sqliteDb.run(sql, params);
    saveSqliteDatabase();
  }
}

export function getOne(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  if (dbMode === 'postgres') {
    // For sync calls in postgres mode, we need to handle this differently
    // This is a limitation - for now, return undefined and use async version
    console.warn('getOne called in sync mode for PostgreSQL - use getOneAsync instead');
    return undefined;
  }

  if (!sqliteDb) throw new Error('Database not initialized');
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as Record<string, unknown>;
  }

  stmt.free();
  return undefined;
}

export async function getOneAsync(sql: string, params: SqlValue[] = []): Promise<Record<string, unknown> | undefined> {
  if (dbMode === 'postgres') {
    if (!pgPool) throw new Error('Database not initialized');
    let paramIndex = 0;
    const convertedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    const result = await pgPool.query(convertedSql, params);
    return result.rows[0];
  }

  return getOne(sql, params);
}

export function getAll(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  if (dbMode === 'postgres') {
    console.warn('getAll called in sync mode for PostgreSQL - use getAllAsync instead');
    return [];
  }

  if (!sqliteDb) throw new Error('Database not initialized');
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }

  stmt.free();
  return results;
}

export async function getAllAsync(sql: string, params: SqlValue[] = []): Promise<Record<string, unknown>[]> {
  if (dbMode === 'postgres') {
    if (!pgPool) throw new Error('Database not initialized');
    let paramIndex = 0;
    const convertedSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    const result = await pgPool.query(convertedSql, params);
    return result.rows;
  }

  return getAll(sql, params);
}

// Legacy compatibility functions
export async function getDb(): Promise<SqlJsDatabase> {
  if (sqliteDb) return sqliteDb;
  throw new Error('SQLite database not available in PostgreSQL mode');
}

export function getDbSync(): SqlJsDatabase {
  if (!sqliteDb) {
    throw new Error('SQLite database not available');
  }
  return sqliteDb;
}

export function saveDatabase(): void {
  if (dbMode === 'sqlite') {
    saveSqliteDatabase();
  }
  // PostgreSQL auto-commits
}

export function closeDatabase(): void {
  if (dbMode === 'sqlite' && sqliteDb) {
    saveSqliteDatabase();
    sqliteDb.close();
    sqliteDb = null;
  }
  if (pgPool) {
    pgPool.end();
    pgPool = null;
  }
}

// Export current mode for checking
export function getDatabaseMode(): DbMode {
  return dbMode;
}
