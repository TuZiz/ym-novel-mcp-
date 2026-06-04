import type Database from "better-sqlite3";
import { nowIso } from "../utils/text.js";
import { repairFtsIndexes } from "./fts.js";
import { schemaStatements } from "./schema.js";

const migrations = [
  {
    version: 1,
    name: "init-schema",
    statements: schemaStatements
  }
] as const;

export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`
  );

  const getApplied = db.prepare(
    "SELECT version FROM migrations WHERE version = ?"
  );
  const insertMigration = db.prepare(
    "INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)"
  );

  const applyMigration = db.transaction(
    (version: number, name: string, statements: readonly string[]) => {
      for (const statement of statements) {
        db.exec(statement);
      }

      insertMigration.run(version, name, nowIso());
    }
  );

  for (const migration of migrations) {
    const applied = getApplied.get(migration.version);
    if (!applied) {
      applyMigration(migration.version, migration.name, migration.statements);
    }
  }

  for (const statement of schemaStatements) {
    db.exec(statement);
  }

  repairFtsIndexes(db);
}
