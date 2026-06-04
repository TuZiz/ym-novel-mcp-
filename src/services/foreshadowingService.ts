import type Database from "better-sqlite3";
import type {
  AddForeshadowingInput,
  Foreshadowing,
  ResolveForeshadowingInput
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapForeshadowingRow } from "../utils/rows.js";
import { nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { ChapterService } from "./chapterService.js";
import { ProjectService } from "./projectService.js";

export class ForeshadowingService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly chapterService: ChapterService
  ) {}

  addForeshadowing(input: AddForeshadowingInput): Foreshadowing {
    this.projectService.ensureProjectExists(input.projectId);
    if (input.introducedChapterId) {
      this.chapterService.getChapter(input.projectId, input.introducedChapterId);
    }

    const id = createId("foreshadowing");
    const now = nowIso();

    this.db
      .prepare(
        `INSERT INTO foreshadowings (
          id, project_id, title, description, introduced_chapter_id, expected_resolve_chapter,
          resolved_chapter_id, status, importance, related_characters, related_world_items, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'open', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.projectId,
        input.title,
        input.description,
        input.introducedChapterId ?? null,
        input.expectedResolveChapter ?? null,
        input.importance ?? 3,
        serializeStringArray(uniqueStrings(input.relatedCharacters ?? [])),
        serializeStringArray(uniqueStrings(input.relatedWorldItems ?? [])),
        input.notes ?? null,
        now,
        now
      );

    return this.getForeshadowing(input.projectId, id);
  }

  getForeshadowing(projectId: string, foreshadowingId: string): Foreshadowing {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM foreshadowings WHERE project_id = ? AND id = ?")
      .get(projectId, foreshadowingId) as Record<string, unknown> | undefined;

    return mapForeshadowingRow(
      assertFound(row, `Foreshadowing ${foreshadowingId} not found.`)
    );
  }

  listForeshadowings(projectId: string): Foreshadowing[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM foreshadowings WHERE project_id = ? ORDER BY importance DESC, created_at ASC"
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapForeshadowingRow);
  }

  listOpenForeshadowings(projectId: string, limit = 20): Foreshadowing[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        `SELECT * FROM foreshadowings
        WHERE project_id = ? AND status IN ('open', 'partially_resolved')
        ORDER BY importance DESC, created_at ASC
        LIMIT ?`
      )
      .all(projectId, limit) as Record<string, unknown>[];

    return rows.map(mapForeshadowingRow);
  }

  resolveForeshadowing(input: ResolveForeshadowingInput): Foreshadowing {
    const current = this.getForeshadowing(input.projectId, input.foreshadowingId);
    if (input.resolvedChapterId) {
      this.chapterService.getChapter(input.projectId, input.resolvedChapterId);
    }

    this.db
      .prepare(
        `UPDATE foreshadowings
        SET resolved_chapter_id = ?, status = ?, notes = ?, updated_at = ?
        WHERE id = ? AND project_id = ?`
      )
      .run(
        input.resolvedChapterId ?? current.resolvedChapterId,
        input.status ?? "resolved",
        input.notes ?? current.notes,
        nowIso(),
        input.foreshadowingId,
        input.projectId
      );

    return this.getForeshadowing(input.projectId, input.foreshadowingId);
  }

  searchForeshadowings(projectId: string, query: string, limit = 8): Foreshadowing[] {
    this.projectService.ensureProjectExists(projectId);
    if (!query.trim()) {
      return this.listForeshadowings(projectId).slice(0, limit);
    }

    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM foreshadowings
        WHERE project_id = ? AND (
          title LIKE ? OR description LIKE ? OR notes LIKE ? OR
          related_characters LIKE ? OR related_world_items LIKE ?
        )
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?`
      )
      .all(projectId, like, like, like, like, like, limit) as Record<
      string,
      unknown
    >[];

    return rows.map(mapForeshadowingRow);
  }
}
