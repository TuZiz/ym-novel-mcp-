import type Database from "better-sqlite3";
import type { AddTimelineEventInput, TimelineEvent } from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapTimelineEventRow } from "../utils/rows.js";
import { nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { ChapterService } from "./chapterService.js";
import { ProjectService } from "./projectService.js";

export class TimelineService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly chapterService: ChapterService
  ) {}

  addTimelineEvent(input: AddTimelineEventInput): TimelineEvent {
    this.projectService.ensureProjectExists(input.projectId);
    if (input.chapterId) {
      this.chapterService.getChapter(input.projectId, input.chapterId);
    }

    const id = createId("timeline");
    const now = nowIso();

    this.db
      .prepare(
        `INSERT INTO timeline_events (
          id, project_id, chapter_id, event_order, title, description, involved_characters, location, impact, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.projectId,
        input.chapterId ?? null,
        input.eventOrder,
        input.title,
        input.description,
        serializeStringArray(uniqueStrings(input.involvedCharacters ?? [])),
        input.location ?? null,
        input.impact ?? null,
        now,
        now
      );

    return this.getTimelineEvent(input.projectId, id);
  }

  getTimelineEvent(projectId: string, eventId: string): TimelineEvent {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM timeline_events WHERE project_id = ? AND id = ?")
      .get(projectId, eventId) as Record<string, unknown> | undefined;

    return mapTimelineEventRow(assertFound(row, `Timeline event ${eventId} not found.`));
  }

  getTimeline(projectId: string): TimelineEvent[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM timeline_events WHERE project_id = ? ORDER BY event_order ASC, created_at ASC"
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapTimelineEventRow);
  }

  searchTimeline(projectId: string, query: string, limit = 8): TimelineEvent[] {
    this.projectService.ensureProjectExists(projectId);
    if (!query.trim()) {
      return this.getTimeline(projectId).slice(0, limit);
    }

    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM timeline_events
        WHERE project_id = ? AND (
          title LIKE ? OR description LIKE ? OR involved_characters LIKE ? OR location LIKE ? OR impact LIKE ?
        )
        ORDER BY event_order ASC, created_at ASC
        LIMIT ?`
      )
      .all(projectId, like, like, like, like, like, limit) as Record<string, unknown>[];

    return rows.map(mapTimelineEventRow);
  }
}
