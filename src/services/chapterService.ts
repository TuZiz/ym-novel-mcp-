import type Database from "better-sqlite3";
import type {
  Chapter,
  GetRecentChaptersInput,
  SaveChapterInput,
  UpdateChapterSummaryInput
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapChapterRow } from "../utils/rows.js";
import {
  buildFtsQuery,
  countWords,
  excerptEnd,
  excerptStart,
  nowIso,
  serializeStringArray,
  uniqueStrings
} from "../utils/text.js";
import { OutlineService } from "./outlineService.js";
import { ProjectService } from "./projectService.js";

export class ChapterService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly outlineService: OutlineService
  ) {}

  saveChapter(input: SaveChapterInput): Chapter {
    this.projectService.ensureProjectExists(input.projectId);
    if (input.volumeId) {
      this.outlineService.getVolume(input.projectId, input.volumeId);
    }

    const existing = this.db
      .prepare("SELECT id, created_at FROM chapters WHERE project_id = ? AND chapter_index = ?")
      .get(input.projectId, input.chapterIndex) as
      | { id: string; created_at: string }
      | undefined;

    const chapterId = existing?.id ?? createId("chapter");
    const createdAt = existing?.created_at ?? nowIso();
    const updatedAt = nowIso();
    const wordCount = countWords(input.content);
    const opening = excerptStart(input.content);
    const ending = excerptEnd(input.content);
    const involvedCharacters = uniqueStrings(input.involvedCharacters ?? []);
    const involvedWorldItems = uniqueStrings(input.involvedWorldItems ?? []);

    const transaction = this.db.transaction(() => {
      if (existing) {
        this.db
          .prepare(
            `UPDATE chapters
            SET volume_id = ?, title = ?, content = ?, summary = ?, word_count = ?, opening = ?, ending = ?,
                hook = ?, involved_characters = ?, involved_world_items = ?, status = ?, updated_at = ?
            WHERE id = ?`
          )
          .run(
            input.volumeId ?? null,
            input.title,
            input.content,
            input.summary ?? null,
            wordCount,
            opening,
            ending,
            input.hook ?? null,
            serializeStringArray(involvedCharacters),
            serializeStringArray(involvedWorldItems),
            input.status ?? "draft",
            updatedAt,
            chapterId
          );
      } else {
        this.db
          .prepare(
            `INSERT INTO chapters (
              id, project_id, volume_id, chapter_index, title, content, summary, word_count, opening, ending,
              hook, involved_characters, involved_world_items, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            chapterId,
            input.projectId,
            input.volumeId ?? null,
            input.chapterIndex,
            input.title,
            input.content,
            input.summary ?? null,
            wordCount,
            opening,
            ending,
            input.hook ?? null,
            serializeStringArray(involvedCharacters),
            serializeStringArray(involvedWorldItems),
            input.status ?? "draft",
            createdAt,
            updatedAt
          );
      }

      this.db.prepare("DELETE FROM chapters_fts WHERE chapter_id = ?").run(chapterId);
      this.db
        .prepare(
          `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
          VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          input.projectId,
          chapterId,
          input.title,
          input.summary ?? "",
          input.content
        );

      this.db
        .prepare(
          `UPDATE characters
          SET first_appearance_chapter = COALESCE(first_appearance_chapter, ?),
              last_appearance_chapter = CASE
                WHEN last_appearance_chapter IS NULL OR last_appearance_chapter < ? THEN ?
                ELSE last_appearance_chapter
              END,
              updated_at = ?
          WHERE id = ? AND project_id = ?`
        );

      const updateCharacterAppearance = this.db.prepare(
        `UPDATE characters
        SET first_appearance_chapter = COALESCE(first_appearance_chapter, ?),
            last_appearance_chapter = CASE
              WHEN last_appearance_chapter IS NULL OR last_appearance_chapter < ? THEN ?
              ELSE last_appearance_chapter
            END,
            updated_at = ?
        WHERE id = ? AND project_id = ?`
      );

      involvedCharacters.forEach((characterId) => {
        updateCharacterAppearance.run(
          input.chapterIndex,
          input.chapterIndex,
          input.chapterIndex,
          updatedAt,
          characterId,
          input.projectId
        );
      });

      this.db
        .prepare(
          `UPDATE chapter_outlines
          SET status = 'written', updated_at = ?
          WHERE project_id = ? AND chapter_index = ?`
        )
        .run(updatedAt, input.projectId, input.chapterIndex);

      this.db
        .prepare(
          `INSERT INTO canon_facts (
            id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
          ) VALUES (?, ?, 'chapter', ?, 'chapter_summary', ?, 0.88, 3, ?, ?)`
        )
        .run(
          createId("canon"),
          input.projectId,
          chapterId,
          input.summary ?? `${input.title}：${excerptStart(input.content, 80) ?? ""}`,
          updatedAt,
          updatedAt
        );
    });

    transaction();
    this.projectService.refreshProjectWordCount(input.projectId);
    return this.getChapter(input.projectId, chapterId);
  }

  getChapter(projectId: string, chapterId: string): Chapter {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM chapters WHERE project_id = ? AND id = ?")
      .get(projectId, chapterId) as Record<string, unknown> | undefined;

    return mapChapterRow(assertFound(row, `Chapter ${chapterId} not found.`));
  }

  getChapterByIndex(projectId: string, chapterIndex: number): Chapter | null {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM chapters WHERE project_id = ? AND chapter_index = ?")
      .get(projectId, chapterIndex) as Record<string, unknown> | undefined;

    return row ? mapChapterRow(row) : null;
  }

  listChapters(projectId: string): Chapter[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare("SELECT * FROM chapters WHERE project_id = ? ORDER BY chapter_index ASC")
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapChapterRow);
  }

  getRecentChapters(input: GetRecentChaptersInput): Chapter[] {
    this.projectService.ensureProjectExists(input.projectId);
    const limit = input.limit ?? 5;

    const rows = (input.beforeChapterIndex
      ? this.db
          .prepare(
            `SELECT * FROM chapters
            WHERE project_id = ? AND chapter_index < ?
            ORDER BY chapter_index DESC
            LIMIT ?`
          )
          .all(input.projectId, input.beforeChapterIndex, limit)
      : this.db
          .prepare(
            `SELECT * FROM chapters
            WHERE project_id = ?
            ORDER BY chapter_index DESC
            LIMIT ?`
          )
          .all(input.projectId, limit)) as Record<string, unknown>[];

    return rows.map((row) => {
      const chapter = mapChapterRow(row);
      return input.includeContent ? chapter : { ...chapter, content: "" };
    });
  }

  searchChapters(projectId: string, query: string, limit = 8): Chapter[] {
    this.projectService.ensureProjectExists(projectId);
    if (!query.trim()) {
      return this.getRecentChapters({
        projectId,
        limit,
        includeContent: false
      });
    }

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) {
      return [];
    }

    try {
      const rows = this.db
        .prepare(
          `SELECT c.*
          FROM chapters_fts f
          JOIN chapters c ON c.id = f.chapter_id
          WHERE f.project_id = ? AND chapters_fts MATCH ?
          ORDER BY c.chapter_index DESC
          LIMIT ?`
        )
        .all(projectId, ftsQuery, limit) as Record<string, unknown>[];

      if (rows.length > 0) {
        return rows.map(mapChapterRow);
      }
    } catch {
      // Fall through to LIKE search.
    }

    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM chapters
        WHERE project_id = ? AND (title LIKE ? OR summary LIKE ? OR content LIKE ?)
        ORDER BY chapter_index DESC
        LIMIT ?`
      )
      .all(projectId, like, like, like, limit) as Record<string, unknown>[];

    return rows.map(mapChapterRow);
  }

  updateChapterSummary(input: UpdateChapterSummaryInput): Chapter {
    const current = this.getChapter(input.projectId, input.chapterId);
    const updatedAt = nowIso();

    this.db
      .prepare("UPDATE chapters SET summary = ?, updated_at = ? WHERE id = ? AND project_id = ?")
      .run(input.summary, updatedAt, input.chapterId, input.projectId);

    this.db.prepare("DELETE FROM chapters_fts WHERE chapter_id = ?").run(input.chapterId);
    this.db
      .prepare(
        `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
        VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.projectId,
        input.chapterId,
        current.title,
        input.summary,
        current.content
      );

    return this.getChapter(input.projectId, input.chapterId);
  }
}
