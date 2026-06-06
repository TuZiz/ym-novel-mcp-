import type Database from "better-sqlite3";
import type {
  CanonFact,
  CreateProjectInput,
  Project,
  UpdateProjectInput,
  WritingRule,
} from "../types/novel.js";
import { AppError, assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { patchValue } from "../utils/patch.js";
import {
  mapCanonFactRow,
  mapProjectRow,
  mapWritingRuleRow,
} from "../utils/rows.js";
import { nowIso } from "../utils/text.js";

const defaultWritingRules = [
  "小说目标是 500 万到 1000 万字，不要过早完结。",
  "每章必须承接上一章结尾。",
  "每章必须有明确冲突、推进和钩子。",
  "不允许主角突然降智。",
  "不允许人物性格突然改变。",
  "不允许随便遗忘重要人物。",
  "不允许修改已经确定的世界观规则。",
  "不允许一章内灌入过多无关设定。",
  "不允许用总结代替剧情。",
  "不允许大量空泛心理描写水字数。",
  "每章结尾必须制造期待感。",
  "伏笔必须记录，不能随意丢弃。",
  "战力体系必须稳定，不能随意崩坏。",
  "人物关系变化必须有过程。",
  "写作风格偏番茄小说，节奏快、爽点明确、情绪直接、钩子强。",
];

export class ProjectService {
  constructor(private readonly db: Database.Database) {}

  createProject(input: CreateProjectInput): Project {
    const now = nowIso();
    const id = createId("project");

    this.db
      .prepare(
        `INSERT INTO projects (
          id, name, genre, platform, target_words, chapter_word_target, min_chapter_words,
          max_chapter_words, current_words, style, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'planning', ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.genre ?? null,
        input.platform ?? null,
        input.targetWords ?? null,
        input.chapterWordTarget ?? null,
        input.minChapterWords ?? null,
        input.maxChapterWords ?? null,
        input.style ?? null,
        now,
        now,
      );

    const insertRule = this.db.prepare(
      `INSERT INTO writing_rules (
        id, project_id, rule_type, content, priority, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    );

    const insertCanonFact = this.db.prepare(
      `INSERT INTO canon_facts (
        id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
      ) VALUES (?, ?, 'project', ?, 'project_goal', ?, 0.95, 5, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      defaultWritingRules.forEach((rule, index) => {
        insertRule.run(
          createId("rule"),
          id,
          "default",
          rule,
          index + 1,
          now,
          now,
        );
      });

      insertCanonFact.run(
        createId("canon"),
        id,
        id,
        `项目《${input.name}》已初始化，目标是长期维护的长篇小说创作。`,
        now,
        now,
      );
    });

    transaction();
    return this.getProject(id);
  }

  getProject(projectId: string): Project {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as Record<string, unknown> | undefined;

    return mapProjectRow(assertFound(row, `Project ${projectId} not found.`));
  }

  listProjects(): Project[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];

    return rows.map(mapProjectRow);
  }

  updateProject(projectId: string, patch: UpdateProjectInput): Project {
    const current = this.getProject(projectId);
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE projects
        SET name = ?, genre = ?, platform = ?, target_words = ?, chapter_word_target = ?,
            min_chapter_words = ?, max_chapter_words = ?, current_words = ?, style = ?,
            status = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(
        patchValue(patch.name, current.name),
        patchValue(patch.genre, current.genre),
        patchValue(patch.platform, current.platform),
        patchValue(patch.targetWords, current.targetWords),
        patchValue(patch.chapterWordTarget, current.chapterWordTarget),
        patchValue(patch.minChapterWords, current.minChapterWords),
        patchValue(patch.maxChapterWords, current.maxChapterWords),
        patchValue(patch.currentWords, current.currentWords),
        patchValue(patch.style, current.style),
        patchValue(patch.status, current.status),
        updatedAt,
        projectId,
      );

    return this.getProject(projectId);
  }

  listWritingRules(projectId: string): WritingRule[] {
    this.getProject(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM writing_rules WHERE project_id = ? ORDER BY priority ASC, created_at ASC",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapWritingRuleRow);
  }

  listCanonFacts(projectId: string, limit = 50): CanonFact[] {
    this.getProject(projectId);
    const rows = this.db
      .prepare(
        `SELECT * FROM canon_facts
        WHERE project_id = ?
        ORDER BY importance DESC, created_at DESC
        LIMIT ?`,
      )
      .all(projectId, limit) as Record<string, unknown>[];

    return rows.map(mapCanonFactRow);
  }

  refreshProjectWordCount(projectId: string): Project {
    this.getProject(projectId);

    this.db
      .prepare(
        `UPDATE projects
        SET current_words = COALESCE((SELECT SUM(word_count) FROM chapters WHERE project_id = ?), 0),
            updated_at = ?
        WHERE id = ?`,
      )
      .run(projectId, nowIso(), projectId);

    return this.getProject(projectId);
  }

  ensureProjectExists(projectId: string): void {
    const exists = this.db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;

    if (!exists) {
      throw new AppError(`Project ${projectId} not found.`, "NOT_FOUND");
    }
  }
}
