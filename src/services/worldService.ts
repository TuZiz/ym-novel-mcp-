import type Database from "better-sqlite3";
import type { AddWorldItemInput, WorldItem } from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapWorldItemRow } from "../utils/rows.js";
import { buildFtsQuery, nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { ProjectService } from "./projectService.js";

export class WorldService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService
  ) {}

  addWorldItem(input: AddWorldItemInput): WorldItem {
    this.projectService.ensureProjectExists(input.projectId);

    const id = createId("world");
    const now = nowIso();
    const tags = uniqueStrings(input.tags ?? []);

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO world_items (
            id, project_id, type, name, content, importance, tags, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.projectId,
          input.type,
          input.name,
          input.content,
          input.importance ?? 3,
          serializeStringArray(tags),
          now,
          now
        );

      this.db
        .prepare("DELETE FROM world_items_fts WHERE world_item_id = ?")
        .run(id);
      this.db
        .prepare(
          `INSERT INTO world_items_fts (project_id, world_item_id, name, content, tags)
          VALUES (?, ?, ?, ?, ?)`
        )
        .run(input.projectId, id, input.name, input.content, tags.join(" "));

      this.db
        .prepare(
          `INSERT INTO canon_facts (
            id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
          ) VALUES (?, ?, 'world_item', ?, ?, ?, 0.9, ?, ?, ?)`
        )
        .run(
          createId("canon"),
          input.projectId,
          id,
          input.type,
          `${input.name}: ${input.content}`,
          input.importance ?? 3,
          now,
          now
        );
    });

    transaction();
    return this.getWorldItem(input.projectId, id);
  }

  getWorldItem(projectId: string, worldItemId: string): WorldItem {
    this.projectService.ensureProjectExists(projectId);

    const row = this.db
      .prepare("SELECT * FROM world_items WHERE project_id = ? AND id = ?")
      .get(projectId, worldItemId) as Record<string, unknown> | undefined;

    return mapWorldItemRow(assertFound(row, `World item ${worldItemId} not found.`));
  }

  listWorldItems(projectId: string): WorldItem[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM world_items WHERE project_id = ? ORDER BY importance DESC, updated_at DESC"
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapWorldItemRow);
  }

  searchWorldItems(
    projectId: string,
    query: string,
    type?: string,
    limit = 8
  ): WorldItem[] {
    this.projectService.ensureProjectExists(projectId);

    if (!query.trim()) {
      const sql = type
        ? "SELECT * FROM world_items WHERE project_id = ? AND type = ? ORDER BY importance DESC, updated_at DESC LIMIT ?"
        : "SELECT * FROM world_items WHERE project_id = ? ORDER BY importance DESC, updated_at DESC LIMIT ?";
      const rows = (type
        ? this.db.prepare(sql).all(projectId, type, limit)
        : this.db.prepare(sql).all(projectId, limit)) as Record<string, unknown>[];
      return rows.map(mapWorldItemRow);
    }

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) {
      return [];
    }

    try {
      const rows = (type
        ? this.db
            .prepare(
              `SELECT w.*
              FROM world_items_fts f
              JOIN world_items w ON w.id = f.world_item_id
              WHERE f.project_id = ? AND w.type = ? AND world_items_fts MATCH ?
              ORDER BY w.importance DESC, w.updated_at DESC
              LIMIT ?`
            )
            .all(projectId, type, ftsQuery, limit)
        : this.db
            .prepare(
              `SELECT w.*
              FROM world_items_fts f
              JOIN world_items w ON w.id = f.world_item_id
              WHERE f.project_id = ? AND world_items_fts MATCH ?
              ORDER BY w.importance DESC, w.updated_at DESC
              LIMIT ?`
            )
            .all(projectId, ftsQuery, limit)) as Record<string, unknown>[];

      if (rows.length > 0) {
        return rows.map(mapWorldItemRow);
      }
    } catch {
      // Fall through to LIKE search.
    }

    const like = `%${query.trim()}%`;
    const rows = (type
      ? this.db
          .prepare(
            `SELECT * FROM world_items
            WHERE project_id = ? AND type = ? AND (name LIKE ? OR content LIKE ? OR tags LIKE ?)
            ORDER BY importance DESC, updated_at DESC
            LIMIT ?`
          )
          .all(projectId, type, like, like, like, limit)
      : this.db
          .prepare(
            `SELECT * FROM world_items
            WHERE project_id = ? AND (name LIKE ? OR content LIKE ? OR tags LIKE ?)
            ORDER BY importance DESC, updated_at DESC
            LIMIT ?`
          )
          .all(projectId, like, like, like, limit)) as Record<string, unknown>[];

    return rows.map(mapWorldItemRow);
  }

  getWorldContext(projectId: string, query: string, limit = 8): WorldItem[] {
    return this.searchWorldItems(projectId, query, undefined, limit);
  }
}
