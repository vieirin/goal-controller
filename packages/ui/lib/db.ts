import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

// Database path - stored in the project root's data directory
const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

// Migrations directory - relative to project root
const MIGRATIONS_DIR = path.join(process.cwd(), 'lib', 'migrations');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get the singleton database instance
 */
export function getDb(): Database.Database {
  if (!db) {
    // Ensure the data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Run migrations
    runMigrations(db);
  }
  return db;
}

/**
 * Run database migrations from filesystem
 */
function runMigrations(database: Database.Database): void {
  // Create migrations table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of applied migrations
  const appliedMigrations = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  const appliedNames = new Set(appliedMigrations.map((m) => m.name));

  // Read migration files from filesystem
  if (!existsSync(MIGRATIONS_DIR)) {
    // In development, migrations might be in a different location
    const altMigrationsDir = path.join(process.cwd(), 'packages', 'ui', 'lib', 'migrations');
    if (existsSync(altMigrationsDir)) {
      runMigrationsFromDir(database, altMigrationsDir, appliedNames);
      return;
    }
    console.warn(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    return;
  }

  runMigrationsFromDir(database, MIGRATIONS_DIR, appliedNames);
}

/**
 * Run migrations from a specific directory
 */
function runMigrationsFromDir(
  database: Database.Database,
  dir: string,
  appliedNames: Set<string>
): void {
  const migrationFiles = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order

  // Run pending migrations
  for (const file of migrationFiles) {
    const migrationName = file.replace('.sql', '');

    if (!appliedNames.has(migrationName)) {
      const migrationPath = path.join(dir, file);
      const sql = readFileSync(migrationPath, 'utf-8');

      try {
        database.exec(sql);
        database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
        console.log(`Migration applied: ${migrationName}`);
      } catch (error) {
        console.error(`Failed to apply migration ${migrationName}:`, error);
        throw error;
      }
    }
  }
}

/**
 * Close the database connection (for cleanup)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get the database file path (useful for debugging)
 */
export function getDbPath(): string {
  return DB_PATH;
}
