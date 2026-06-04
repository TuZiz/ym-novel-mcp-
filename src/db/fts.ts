import type Database from "better-sqlite3";

type CountRow = {
  count: number;
};

export function repairFtsIndexes(db: Database.Database): void {
  const projectRows = db
    .prepare("SELECT id FROM projects")
    .all() as Array<{ id: string }>;

  for (const row of projectRows) {
    repairProjectFtsIndexes(db, row.id);
  }
}

export function repairProjectFtsIndexes(
  db: Database.Database,
  projectId: string
): void {
  if (needsProjectFtsRepair(db, projectId)) {
    rebuildProjectFtsIndexes(db, projectId);
  }
}

export function rebuildProjectFtsIndexes(
  db: Database.Database,
  projectId: string
): void {
  const rebuild = db.transaction(() => {
    db.prepare("DELETE FROM chapters_fts WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM world_items_fts WHERE project_id = ?").run(projectId);

    db.prepare(
      `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
      SELECT project_id, id, title, COALESCE(summary, ''), content
      FROM chapters
      WHERE project_id = ?`
    ).run(projectId);

    db.prepare(
      `INSERT INTO world_items_fts (project_id, world_item_id, name, content, tags)
      SELECT project_id, id, name, content, tags
      FROM world_items
      WHERE project_id = ?`
    ).run(projectId);
  });

  rebuild();
}

function needsProjectFtsRepair(
  db: Database.Database,
  projectId: string
): boolean {
  return (
    countRows(db, "chapters", projectId) !==
      countRows(db, "chapters_fts", projectId) ||
    countRows(db, "world_items", projectId) !==
      countRows(db, "world_items_fts", projectId)
  );
}

function countRows(
  db: Database.Database,
  tableName: "chapters" | "chapters_fts" | "world_items" | "world_items_fts",
  projectId: string
): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE project_id = ?`)
    .get(projectId) as CountRow;

  return Number(row.count);
}
