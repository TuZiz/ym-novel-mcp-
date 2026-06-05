import type Database from "better-sqlite3";
import type {
  ChapterOutline,
  CreateChapterOutlineInput,
  CreateVolumeInput,
  UpdateChapterOutlineInput,
  UpdateVolumeInput,
  Volume,
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { patchValue } from "../utils/patch.js";
import { mapChapterOutlineRow, mapVolumeRow } from "../utils/rows.js";
import { nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { ProjectService } from "./projectService.js";

export class OutlineService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
  ) {}

  createVolume(input: CreateVolumeInput): Volume {
    this.projectService.ensureProjectExists(input.projectId);

    const id = createId("volume");
    const now = nowIso();

    this.db
      .prepare(
        `INSERT INTO volumes (
          id, project_id, volume_index, title, goal, conflict, start_chapter, end_chapter, summary, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.volumeIndex,
        input.title,
        input.goal ?? null,
        input.conflict ?? null,
        input.startChapter ?? null,
        input.endChapter ?? null,
        input.summary ?? null,
        input.status ?? "planned",
        now,
        now,
      );

    return this.getVolume(input.projectId, id);
  }

  getVolume(projectId: string, volumeId: string): Volume {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM volumes WHERE project_id = ? AND id = ?")
      .get(projectId, volumeId) as Record<string, unknown> | undefined;

    return mapVolumeRow(assertFound(row, `Volume ${volumeId} not found.`));
  }

  getCurrentVolume(projectId: string): Volume | null {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare(
        `SELECT * FROM volumes
        WHERE project_id = ?
        ORDER BY CASE WHEN status IN ('active', 'drafting', 'planned') THEN 0 ELSE 1 END, volume_index DESC
        LIMIT 1`,
      )
      .get(projectId) as Record<string, unknown> | undefined;

    return row ? mapVolumeRow(row) : null;
  }

  updateVolume(input: UpdateVolumeInput): Volume {
    const current = this.getVolume(input.projectId, input.volumeId);
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE volumes
        SET title = ?, goal = ?, conflict = ?, start_chapter = ?, end_chapter = ?, summary = ?, status = ?, updated_at = ?
        WHERE id = ? AND project_id = ?`,
      )
      .run(
        patchValue(input.title, current.title),
        patchValue(input.goal, current.goal),
        patchValue(input.conflict, current.conflict),
        patchValue(input.startChapter, current.startChapter),
        patchValue(input.endChapter, current.endChapter),
        patchValue(input.summary, current.summary),
        patchValue(input.status, current.status),
        updatedAt,
        input.volumeId,
        input.projectId,
      );

    return this.getVolume(input.projectId, input.volumeId);
  }

  listVolumes(projectId: string): Volume[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM volumes WHERE project_id = ? ORDER BY volume_index ASC",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapVolumeRow);
  }

  createChapterOutline(input: CreateChapterOutlineInput): ChapterOutline {
    this.projectService.ensureProjectExists(input.projectId);
    if (input.volumeId) {
      this.getVolume(input.projectId, input.volumeId);
    }

    const id = createId("outline");
    const now = nowIso();

    this.db
      .prepare(
        `INSERT INTO chapter_outlines (
          id, project_id, volume_id, chapter_index, title, goal, conflict, key_events,
          required_characters, required_foreshadowing, ending_hook, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.volumeId ?? null,
        input.chapterIndex,
        input.title,
        input.goal ?? null,
        input.conflict ?? null,
        input.keyEvents ?? null,
        serializeStringArray(uniqueStrings(input.requiredCharacters ?? [])),
        serializeStringArray(uniqueStrings(input.requiredForeshadowing ?? [])),
        input.endingHook ?? null,
        input.status ?? "planned",
        now,
        now,
      );

    return this.getChapterOutlineById(input.projectId, id);
  }

  getChapterOutline(
    projectId: string,
    chapterIndex: number,
  ): ChapterOutline | null {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare(
        "SELECT * FROM chapter_outlines WHERE project_id = ? AND chapter_index = ?",
      )
      .get(projectId, chapterIndex) as Record<string, unknown> | undefined;

    return row ? mapChapterOutlineRow(row) : null;
  }

  getChapterOutlineById(projectId: string, outlineId: string): ChapterOutline {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM chapter_outlines WHERE project_id = ? AND id = ?")
      .get(projectId, outlineId) as Record<string, unknown> | undefined;

    return mapChapterOutlineRow(
      assertFound(row, `Outline ${outlineId} not found.`),
    );
  }

  listChapterOutlines(projectId: string, volumeId?: string): ChapterOutline[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = (
      volumeId
        ? this.db
            .prepare(
              "SELECT * FROM chapter_outlines WHERE project_id = ? AND volume_id = ? ORDER BY chapter_index ASC",
            )
            .all(projectId, volumeId)
        : this.db
            .prepare(
              "SELECT * FROM chapter_outlines WHERE project_id = ? ORDER BY chapter_index ASC",
            )
            .all(projectId)
    ) as Record<string, unknown>[];

    return rows.map(mapChapterOutlineRow);
  }

  updateChapterOutline(input: UpdateChapterOutlineInput): ChapterOutline {
    const current = this.getChapterOutlineById(
      input.projectId,
      input.outlineId,
    );
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE chapter_outlines
        SET chapter_index = ?, title = ?, goal = ?, conflict = ?, key_events = ?,
            required_characters = ?, required_foreshadowing = ?, ending_hook = ?, status = ?, updated_at = ?
        WHERE id = ? AND project_id = ?`,
      )
      .run(
        patchValue(input.chapterIndex, current.chapterIndex),
        patchValue(input.title, current.title),
        patchValue(input.goal, current.goal),
        patchValue(input.conflict, current.conflict),
        patchValue(input.keyEvents, current.keyEvents),
        serializeStringArray(
          uniqueStrings(input.requiredCharacters ?? current.requiredCharacters),
        ),
        serializeStringArray(
          uniqueStrings(
            input.requiredForeshadowing ?? current.requiredForeshadowing,
          ),
        ),
        patchValue(input.endingHook, current.endingHook),
        patchValue(input.status, current.status),
        updatedAt,
        input.outlineId,
        input.projectId,
      );

    return this.getChapterOutlineById(input.projectId, input.outlineId);
  }
}
