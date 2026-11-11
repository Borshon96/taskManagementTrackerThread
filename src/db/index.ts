import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import NodeSqliteDatabase from "./node-sqlite-database";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

type Connection = { db: DB; sqlite: NodeSqliteDatabase; path: string };

const globalForDb = globalThis as unknown as { __taskTrackerDb?: Connection };

export function dbPath() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DB_PATH ?? "data/app.db");
}

function open(file: string): Connection {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new NodeSqliteDatabase(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite as unknown as Database.Database, { schema });
  migrate(db, { migrationsFolder: path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  return { db, sqlite, path: file };
}

function tasksTableReady(sqlite: NodeSqliteDatabase) {
  const rows = sqlite.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  return rows.some((c) => c.name === "reopened_from_task_id");
}

export function getDb(): DB {
  const file = dbPath();
  const existing = globalForDb.__taskTrackerDb;
  if (existing && existing.path === file) {
    if (tasksTableReady(existing.sqlite)) return existing.db;
    existing.sqlite.close();
    globalForDb.__taskTrackerDb = undefined;
  } else {
    existing?.sqlite.close();
  }
  const conn = open(file);
  globalForDb.__taskTrackerDb = conn;
  return conn.db;
}

export function closeDb() {
  globalForDb.__taskTrackerDb?.sqlite.close();
  globalForDb.__taskTrackerDb = undefined;
}

export { schema };
