import type Database from "better-sqlite3";

type CountRow = {
  count: number;
};

type NeedsRepairRow = {
  needsRepair: number;
};

export function repairFtsIndexes(db: Database.Database): void {
  const projectRows = db.prepare("SELECT id FROM projects").all() as Array<{
    id: string;
  }>;

  for (const row of projectRows) {
    repairProjectFtsIndexes(db, row.id);
  }
}

export function repairProjectFtsIndexes(
  db: Database.Database,
  projectId: string,
): void {
  if (needsProjectFtsRepair(db, projectId)) {
    rebuildProjectFtsIndexes(db, projectId);
  }
}

export function rebuildProjectFtsIndexes(
  db: Database.Database,
  projectId: string,
): void {
  const rebuild = db.transaction(() => {
    db.prepare("DELETE FROM chapters_fts WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM world_items_fts WHERE project_id = ?").run(
      projectId,
    );

    db.prepare(
      `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
      SELECT project_id, id, title, COALESCE(summary, ''), content
      FROM chapters
      WHERE project_id = ?`,
    ).run(projectId);

    db.prepare(
      `INSERT INTO world_items_fts (project_id, world_item_id, name, content, tags)
      SELECT project_id, id, name, content, tags
      FROM world_items
      WHERE project_id = ?`,
    ).run(projectId);
  });

  rebuild();
}

function needsProjectFtsRepair(
  db: Database.Database,
  projectId: string,
): boolean {
  return (
    countRows(db, "chapters", projectId) !==
      countRows(db, "chapters_fts", projectId) ||
    countRows(db, "world_items", projectId) !==
      countRows(db, "world_items_fts", projectId) ||
    hasChapterFtsDrift(db, projectId) ||
    hasWorldItemFtsDrift(db, projectId)
  );
}

function countRows(
  db: Database.Database,
  tableName: "chapters" | "chapters_fts" | "world_items" | "world_items_fts",
  projectId: string,
): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE project_id = ?`)
    .get(projectId) as CountRow;

  return Number(row.count);
}

function hasChapterFtsDrift(db: Database.Database, projectId: string): boolean {
  return hasDrift(
    db,
    `SELECT EXISTS (
      SELECT 1
      FROM chapters c
      LEFT JOIN chapters_fts f ON f.project_id = c.project_id AND f.chapter_id = c.id
      WHERE c.project_id = ?
        AND (
          f.chapter_id IS NULL OR
          f.title IS NOT c.title OR
          f.summary IS NOT COALESCE(c.summary, '') OR
          f.content IS NOT c.content
        )
    ) OR EXISTS (
      SELECT 1
      FROM chapters_fts f
      LEFT JOIN chapters c ON c.project_id = f.project_id AND c.id = f.chapter_id
      WHERE f.project_id = ? AND c.id IS NULL
    ) AS needsRepair`,
    projectId,
  );
}

function hasWorldItemFtsDrift(
  db: Database.Database,
  projectId: string,
): boolean {
  return hasDrift(
    db,
    `SELECT EXISTS (
      SELECT 1
      FROM world_items w
      LEFT JOIN world_items_fts f ON f.project_id = w.project_id AND f.world_item_id = w.id
      WHERE w.project_id = ?
        AND (
          f.world_item_id IS NULL OR
          f.name IS NOT w.name OR
          f.content IS NOT w.content OR
          f.tags IS NOT w.tags
        )
    ) OR EXISTS (
      SELECT 1
      FROM world_items_fts f
      LEFT JOIN world_items w ON w.project_id = f.project_id AND w.id = f.world_item_id
      WHERE f.project_id = ? AND w.id IS NULL
    ) AS needsRepair`,
    projectId,
  );
}

function hasDrift(
  db: Database.Database,
  sql: string,
  projectId: string,
): boolean {
  const row = db.prepare(sql).get(projectId, projectId) as NeedsRepairRow;
  return Boolean(row.needsRepair);
}
