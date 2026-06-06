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
  "小说项目数据以 MCP 数据库为唯一可信来源；任何项目级创作任务必须先读 MCP，再生成，再检查，再写回 MCP。",
  "写正文前必须调用 build_next_chapter_context 获取项目、人物、世界观、伏笔、时间线和写作规则上下文。",
  "写正文后必须调用 review_chapter_quality 检查字数、场景数、冲突推进、结尾钩子、AI 味和总结化比例。",
  "章节质量合格后必须调用 save_chapter_with_quality_gate 保存正文；默认不使用普通 save_chapter。",
  "保存章节后必须调用 build_post_chapter_update_prompt 整理本章新增信息。",
  "完成后处理时必须调用 apply_post_chapter_update 写回章节摘要、人物状态、世界观、伏笔、时间线和 canon facts。",
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
    validateChapterWordConfig({
      chapterWordTarget: input.chapterWordTarget ?? null,
      minChapterWords: input.minChapterWords ?? null,
      maxChapterWords: input.maxChapterWords ?? null,
    });

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
    const nextChapterWordTarget = patchValue(
      patch.chapterWordTarget,
      current.chapterWordTarget,
    );
    const nextMinChapterWords = patchValue(
      patch.minChapterWords,
      current.minChapterWords,
    );
    const nextMaxChapterWords = patchValue(
      patch.maxChapterWords,
      current.maxChapterWords,
    );
    validateChapterWordConfig({
      chapterWordTarget: nextChapterWordTarget,
      minChapterWords: nextMinChapterWords,
      maxChapterWords: nextMaxChapterWords,
    });

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
        nextChapterWordTarget,
        nextMinChapterWords,
        nextMaxChapterWords,
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

function validateChapterWordConfig(config: {
  chapterWordTarget: number | null;
  minChapterWords: number | null;
  maxChapterWords: number | null;
}): void {
  const { chapterWordTarget, minChapterWords, maxChapterWords } = config;
  if (
    minChapterWords !== null &&
    chapterWordTarget !== null &&
    minChapterWords > chapterWordTarget
  ) {
    throw new AppError(
      "minChapterWords must be less than or equal to chapterWordTarget.",
      "INVALID_CHAPTER_WORD_CONFIG",
    );
  }
  if (
    chapterWordTarget !== null &&
    maxChapterWords !== null &&
    chapterWordTarget > maxChapterWords
  ) {
    throw new AppError(
      "chapterWordTarget must be less than or equal to maxChapterWords.",
      "INVALID_CHAPTER_WORD_CONFIG",
    );
  }
  if (
    minChapterWords !== null &&
    maxChapterWords !== null &&
    minChapterWords > maxChapterWords
  ) {
    throw new AppError(
      "minChapterWords must be less than or equal to maxChapterWords.",
      "INVALID_CHAPTER_WORD_CONFIG",
    );
  }
}
