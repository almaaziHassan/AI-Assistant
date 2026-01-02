import { Pool } from 'pg';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

// Type for SQL values (compatible with both pg and sql.js)
export type SqlValue = string | number | null | Uint8Array;

// Database connection mode
type DbMode = 'postgres' | 'sqlite';

// PostgreSQL pool
let pgPool: Pool | null = null;

// In-memory cache for PostgreSQL (for sync operations)
const pgCache: Map<string, Record<string, unknown>[]> = new Map();

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

// Convert ? placeholders to $1, $2, etc for PostgreSQL
function convertToPostgresParams(sql: string): string {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => `$${++paramIndex}`);
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

// Load all data from PostgreSQL into cache
async function loadPostgresCache(): Promise<void> {
  if (!pgPool) return;

  const tables = ['appointments', 'conversations', 'waitlist', 'holidays', 'staff', 'locations', 'callbacks'];

  for (const table of tables) {
    try {
      const result = await pgPool.query(`SELECT * FROM ${table}`);
      pgCache.set(table, result.rows);
    } catch (error) {
      console.error(`Error loading ${table} into cache:`, error);
      pgCache.set(table, []);
    }
  }

  console.log('PostgreSQL cache loaded');
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
    await loadPostgresCache();
  } else {
    await initSqlite();
    createSqliteTables();
  }

  dbInitialized = true;
  console.log('Database initialized successfully');

  // Seed with default data if empty
  const { seedDatabase } = await import('../utils/seedDatabase');
  await seedDatabase();

  // Reload cache after seeding
  if (dbMode === 'postgres') {
    await loadPostgresCache();
  }
}

// Invalidate cache for a table and reload from PostgreSQL
async function refreshCache(table: string): Promise<void> {
  if (dbMode !== 'postgres' || !pgPool) return;

  try {
    const result = await pgPool.query(`SELECT * FROM ${table}`);
    pgCache.set(table, result.rows);
  } catch (error) {
    console.error(`Error refreshing ${table} cache:`, error);
  }
}

// Extract table name from SQL query
function extractTableName(sql: string): string | null {
  const insertMatch = sql.match(/INSERT INTO\s+(\w+)/i);
  const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
  const deleteMatch = sql.match(/DELETE FROM\s+(\w+)/i);
  const selectMatch = sql.match(/FROM\s+(\w+)/i);

  if (insertMatch) return insertMatch[1].toLowerCase();
  if (updateMatch) return updateMatch[1].toLowerCase();
  if (deleteMatch) return deleteMatch[1].toLowerCase();
  if (selectMatch) return selectMatch[1].toLowerCase();

  return null;
}

// Query execution functions
export function runQuery(sql: string, params: SqlValue[] = []): void {
  if (dbMode === 'postgres') {
    const table = extractTableName(sql);

    // For UPDATE queries, update cache immediately
    if (sql.toUpperCase().startsWith('UPDATE') && table) {
      updateCacheImmediately(sql, params, table);
    }

    // For INSERT queries, add to cache immediately
    if (sql.toUpperCase().startsWith('INSERT') && table) {
      insertIntoCacheImmediately(sql, params, table);
    }

    // Run async in background and refresh cache from DB
    runQueryAsync(sql, params)
      .then(() => {
        if (table) refreshCache(table);
      })
      .catch(console.error);
  } else {
    if (!sqliteDb) throw new Error('Database not initialized');
    sqliteDb.run(sql, params);
    saveSqliteDatabase();
  }
}

// Update cache immediately for UPDATE queries
function updateCacheImmediately(sql: string, params: SqlValue[], table: string): void {
  const cached = pgCache.get(table);
  if (!cached) return;

  const sqlLower = sql.toLowerCase();

  // Parse: UPDATE table SET field = ? WHERE id = ?
  // For status updates: UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?
  if (sqlLower.includes('status = ?') && sqlLower.includes('where id = ?')) {
    const newStatus = params[0];
    const updatedAt = params[1];
    const id = params[2];

    const updated = cached.map(row => {
      if (row.id === id) {
        return { ...row, status: newStatus, updated_at: updatedAt };
      }
      return row;
    });
    pgCache.set(table, updated);
  }
}

// Insert into cache immediately for INSERT queries
function insertIntoCacheImmediately(sql: string, params: SqlValue[], table: string): void {
  // For appointments table
  if (table === 'appointments' && sql.toLowerCase().includes('insert into appointments')) {
    const cached = pgCache.get(table) || [];
    // Parse INSERT INTO appointments (...) VALUES (...)
    // The params order matches the column order in the SQL
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch) {
      const columns = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      const newRow: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        newRow[col] = params[idx];
      });
      cached.push(newRow);
      pgCache.set(table, cached);
    }
  }
}

export async function runQueryAsync(sql: string, params: SqlValue[] = []): Promise<void> {
  if (dbMode === 'postgres') {
    if (!pgPool) throw new Error('Database not initialized');
    const convertedSql = convertToPostgresParams(sql);
    await pgPool.query(convertedSql, params);

    // Refresh cache for the affected table
    const table = extractTableName(sql);
    if (table) await refreshCache(table);
  } else {
    if (!sqliteDb) throw new Error('Database not initialized');
    sqliteDb.run(sql, params);
    saveSqliteDatabase();
  }
}

// Helper function to apply SQL-like filters to cached data
function applyFiltersToCache(
  cached: Record<string, unknown>[],
  sql: string,
  params: SqlValue[]
): Record<string, unknown>[] {
  const sqlLower = sql.toLowerCase();
  let result = [...cached];
  let paramIndex = 0;

  // Check >= FIRST (must be before = check to avoid false match)
  // appointment_date >= ?
  if (sqlLower.match(/appointment_date\s*>=\s*\?/)) {
    const dateParam = params[paramIndex++];
    result = result.filter((row) => String(row.appointment_date) >= String(dateParam));
  }
  // appointment_date = ? (only if not >=)
  else if (sqlLower.match(/appointment_date\s*=\s*\?/)) {
    const dateParam = params[paramIndex++];
    result = result.filter((row) => row.appointment_date === dateParam);
  }

  // status IN ('confirmed', 'completed')
  if (sqlLower.includes("status in ('confirmed', 'completed')")) {
    result = result.filter((row) => row.status === 'confirmed' || row.status === 'completed');
  }

  // status IN ('pending', 'confirmed')
  if (sqlLower.includes("status in ('pending', 'confirmed')")) {
    result = result.filter((row) => row.status === 'pending' || row.status === 'confirmed');
  }

  // status = 'cancelled'
  if (sqlLower.includes("status = 'cancelled'")) {
    result = result.filter((row) => row.status === 'cancelled');
  }

  // status = 'waiting'
  if (sqlLower.includes("status = 'waiting'")) {
    result = result.filter((row) => row.status === 'waiting');
  }

  // status = 'pending'
  if (sqlLower.includes("status = 'pending'")) {
    result = result.filter((row) => row.status === 'pending');
  }

  return result;
}

export function getOne(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  if (dbMode === 'postgres') {
    const sqlLower = sql.toLowerCase();
    const table = extractTableName(sql);
    if (!table) return undefined;

    let cached = pgCache.get(table) || [];

    // Handle COUNT(*) queries
    if (sqlLower.includes('count(*)')) {
      // Apply filters first
      cached = applyFiltersToCache(cached, sql, params);
      return { count: cached.length };
    }

    // Simple WHERE clause matching for common queries
    if (params.length > 0) {
      // Try to find by ID (most common case)
      const idMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
      if (idMatch) {
        return cached.find((row) => row.id === params[0]);
      }

      // For other queries, apply filters and return first
      cached = applyFiltersToCache(cached, sql, params);
      return cached[0];
    }

    return cached[0];
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
    const convertedSql = convertToPostgresParams(sql);
    const result = await pgPool.query(convertedSql, params);
    return result.rows[0];
  }

  return getOne(sql, params);
}

export function getAll(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  if (dbMode === 'postgres') {
    // Use cache for reads
    const table = extractTableName(sql);
    if (!table) return [];

    let cached = pgCache.get(table) || [];

    // Parse all WHERE conditions for comprehensive filtering
    const sqlLower = sql.toLowerCase();

    // Extract parameters based on their position in the SQL
    let paramIndex = 0;

    // Match customer_email = ?
    if (sqlLower.includes('customer_email') && sqlLower.includes('=')) {
      const emailParam = params[paramIndex++];
      cached = cached.filter((row) =>
        String(row.customer_email).toLowerCase() === String(emailParam).toLowerCase()
      );
    }

    // Match appointment_date = ?
    if (sqlLower.includes('appointment_date') && sqlLower.match(/appointment_date\s*=\s*\?/)) {
      const dateParam = params[paramIndex++];
      cached = cached.filter((row) => row.appointment_date === dateParam);
    }

    // Match service_id = ?
    if (sqlLower.includes('service_id') && sqlLower.match(/service_id\s*=\s*\?/)) {
      const serviceParam = params[paramIndex++];
      cached = cached.filter((row) => row.service_id === serviceParam);
    }

    // Match appointment_time = ?
    if (sqlLower.includes('appointment_time') && sqlLower.match(/appointment_time\s*=\s*\?/)) {
      const timeParam = params[paramIndex++];
      cached = cached.filter((row) => row.appointment_time === timeParam);
    }

    // Match staff_id = ? (for staff-specific slot availability)
    if (sqlLower.includes('staff_id') && sqlLower.match(/staff_id\s*=\s*\?/)) {
      const staffParam = params[paramIndex++];
      cached = cached.filter((row) => row.staff_id === staffParam);
    }

    // Match status IN ('pending', 'confirmed')
    if (sqlLower.includes("status in ('pending', 'confirmed')") ||
      sqlLower.includes('status in (\'pending\', \'confirmed\')')) {
      cached = cached.filter((row) =>
        row.status === 'pending' || row.status === 'confirmed'
      );
    }

    // WHERE status = ? (simple single status match)
    if (sqlLower.match(/where\s+status\s*=\s*\?/) && !sqlLower.includes('customer_email')) {
      cached = cached.filter((row) => row.status === params[0]);
    }

    // WHERE appointment_date >= ?
    if (sqlLower.match(/appointment_date\s*>=\s*\?/)) {
      const idx = paramIndex > 0 ? paramIndex : 0;
      cached = cached.filter((row) => String(row.appointment_date) >= String(params[idx]));
    }

    // WHERE appointment_date BETWEEN ? AND ?
    if (sqlLower.includes('between')) {
      const betweenMatch = sqlLower.match(/appointment_date\s+between/);
      if (betweenMatch) {
        cached = cached.filter((row) =>
          String(row.appointment_date) >= String(params[0]) &&
          String(row.appointment_date) <= String(params[1])
        );
      }
    }

    // WHERE is_active = 1
    if (sqlLower.includes('is_active = 1') || sqlLower.includes('is_active=1')) {
      cached = cached.filter((row) => row.is_active === 1 || row.is_active === true);
    }

    // WHERE session_id = ?
    if (sqlLower.match(/where\s+session_id\s*=\s*\?/)) {
      cached = cached.filter((row) => row.session_id === params[0]);
    }

    // WHERE customer_email = ? (standalone - reset param index for this case)
    if (sqlLower.match(/where\s+customer_email\s*=\s*\?/) && !sqlLower.includes('appointment_date')) {
      cached = cached.filter((row) =>
        String(row.customer_email).toLowerCase() === String(params[0]).toLowerCase()
      );
    }

    // ORDER BY
    if (sql.includes('ORDER BY')) {
      const descMatch = sql.match(/ORDER BY\s+(\w+)\s+DESC/i);
      const ascMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+ASC)?/i);

      if (descMatch) {
        const field = descMatch[1];
        cached = [...cached].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
      } else if (ascMatch) {
        const field = ascMatch[1];
        cached = [...cached].sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')));
      }
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      cached = cached.slice(0, parseInt(limitMatch[1]));
    }

    return cached;
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
    const convertedSql = convertToPostgresParams(sql);
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

// Force cache refresh (call after database changes from external sources)
export async function refreshAllCaches(): Promise<void> {
  if (dbMode === 'postgres') {
    await loadPostgresCache();
  }
}
