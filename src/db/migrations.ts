import type Database from "better-sqlite3";
import { nowIso } from "../utils/text.js";
import { repairFtsIndexes } from "./fts.js";
import { schemaStatements } from "./schema.js";

const migrations = [
  {
    version: 1,
    name: "init-schema",
    statements: schemaStatements,
  },
  {
    version: 2,
    name: "project-snapshots",
    statements: [
      `CREATE TABLE IF NOT EXISTS project_snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label TEXT,
        notes TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_created ON project_snapshots(project_id, created_at DESC)`,
    ],
  },
  {
    version: 3,
    name: "learning-memory",
    statements: [
      `CREATE TABLE IF NOT EXISTS experience_records (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        reason TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        source_type TEXT,
        source_id TEXT,
        confidence REAL NOT NULL DEFAULT 0.8,
        score INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_experience_records_project_status ON experience_records(project_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_experience_records_scope_type ON experience_records(scope, type, status)`,
      `CREATE INDEX IF NOT EXISTS idx_experience_records_score ON experience_records(score DESC, confidence DESC, usage_count DESC, updated_at DESC)`,
      `CREATE TABLE IF NOT EXISTS feedback_events (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id TEXT,
        rating INTEGER,
        feedback TEXT NOT NULL,
        action TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_feedback_events_project_created ON feedback_events(project_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_feedback_events_target ON feedback_events(target_type, target_id)`,
      `CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workflow_type TEXT NOT NULL,
        input_summary TEXT,
        output_summary TEXT,
        result TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_type_created ON workflow_runs(project_id, workflow_type, created_at DESC)`,
    ],
  },
  {
    version: 4,
    name: "mcp-call-logs",
    statements: [
      `CREATE TABLE IF NOT EXISTS mcp_call_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        tool_name TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        input_preview TEXT,
        output_preview TEXT,
        content_preview TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_created ON mcp_call_logs(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_project_created ON mcp_call_logs(project_id, created_at DESC)`,
    ],
  },
] as const;

export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const getApplied = db.prepare(
    "SELECT version FROM migrations WHERE version = ?",
  );
  const insertMigration = db.prepare(
    "INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  const applyMigration = db.transaction(
    (version: number, name: string, statements: readonly string[]) => {
      for (const statement of statements) {
        db.exec(statement);
      }

      insertMigration.run(version, name, nowIso());
    },
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
