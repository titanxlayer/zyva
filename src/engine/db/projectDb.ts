/**
 * Per-project persistent SQLite database.
 * Lives at <projectPath>/.zyva/project.db
 *
 * Supports arbitrary SQL issued by the agent via the db_query tool.
 * Schema is user-defined (the agent creates tables as needed).
 *
 * Provides one bootstrap table: _zyva_meta (project name, created_at, version).
 * All other tables are created on demand by the agent or user.
 */

import path from 'path';
import fs from 'fs';
import type DatabaseType from 'better-sqlite3';

const ZYVA_DIR = '.zyva';
const DB_FILE  = 'project.db';
const cache = new Map<string, ProjectDb>();

// Lazily require better-sqlite3 so importing this module never loads the native
// binding (keeps the agent loop working on desktop builds without SQLite packaged).
let DatabaseCtor: typeof DatabaseType | null = null;
function loadDatabaseCtor(): typeof DatabaseType {
  if (DatabaseCtor) return DatabaseCtor;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseCtor = require('better-sqlite3') as typeof DatabaseType;
  return DatabaseCtor;
}

export class ProjectDb {
  private db: DatabaseType.Database;

  constructor(projectPath: string) {
    const dir = path.join(projectPath, ZYVA_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const dbPath = path.join(dir, DB_FILE);
    const Database = loadDatabaseCtor();
    this.db = new Database(dbPath);
    // WAL mode — better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.#bootstrap();
  }

  #bootstrap() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _zyva_meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
      INSERT OR IGNORE INTO _zyva_meta (key, value)
        VALUES ('created_at', datetime('now')),
               ('version',    '1');
    `);
  }

  /** Execute any SQL. Reads return rows; writes return { changes, lastInsertRowid }. */
  query(sql: string, params: (string | number | null)[] = []): unknown {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();
    // Deny anything that touches outside the DB (attach, load_extension …)
    if (/\b(ATTACH|DETACH|LOAD_EXTENSION|PRAGMA\s+locking_mode)\b/i.test(trimmed)) {
      throw new Error('SQL statement not permitted');
    }
    if (upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA')) {
      return this.db.prepare(trimmed).all(...params);
    }
    const info = this.db.prepare(trimmed).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }

  /** Run multi-statement SQL (create schema, seed, migrations). */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
    // remove from cache
    for (const [k, v] of cache.entries()) {
      if (v === this) { cache.delete(k); break; }
    }
  }
}

/** Get (or create) the per-project DB, cached for the process lifetime. */
export async function getProjectDb(projectPath: string): Promise<ProjectDb> {
  const key = path.resolve(projectPath);
  let db = cache.get(key);
  if (!db) {
    db = new ProjectDb(key);
    cache.set(key, db);
  }
  return db;
}

/** Drop and remove the DB file (used in cleanup / tests). */
export function dropProjectDb(projectPath: string): void {
  const key = path.resolve(projectPath);
  const db = cache.get(key);
  if (db) { db.close(); }
  const dbPath = path.join(key, ZYVA_DIR, DB_FILE);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}
