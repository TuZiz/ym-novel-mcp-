import type Database from "better-sqlite3";
import type {
  Chapter,
  ChapterQualityIssue,
  ChapterQualityReview,
  ExpandChapterPromptInput,
  GetRecentChaptersInput,
  ReviewChapterQualityInput,
  SaveChapterInput,
  UpdateChapterSummaryInput,
} from "../types/novel.js";
import { AppError, assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapChapterRow } from "../utils/rows.js";
import {
  buildFtsQuery,
  countWords,
  excerptEnd,
  excerptStart,
  nowIso,
  serializeStringArray,
  uniqueStrings,
} from "../utils/text.js";
import { OutlineService } from "./outlineService.js";
import { ProjectService } from "./projectService.js";

export class ChapterService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly outlineService: OutlineService,
  ) {}

  saveChapter(input: SaveChapterInput): Chapter {
    this.projectService.ensureProjectExists(input.projectId);
    if (input.volumeId) {
      this.outlineService.getVolume(input.projectId, input.volumeId);
    }

    const review = this.reviewChapterQuality({
      projectId: input.projectId,
      chapterIndex: input.chapterIndex,
      title: input.title,
      content: input.content,
      hook: input.hook,
    });
    if (review.allowShortReasonRequired && !input.allowShortReason?.trim()) {
      throw new AppError(
        `Chapter has ${review.wordCount} words, below minChapterWords ${review.minChapterWords}. Provide allowShortReason to save intentionally short chapters.`,
        "QUALITY_GATE_FAILED",
      );
    }

    const existing = this.db
      .prepare(
        "SELECT id, created_at FROM chapters WHERE project_id = ? AND chapter_index = ?",
      )
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
            WHERE id = ?`,
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
            chapterId,
          );
      } else {
        this.db
          .prepare(
            `INSERT INTO chapters (
              id, project_id, volume_id, chapter_index, title, content, summary, word_count, opening, ending,
              hook, involved_characters, involved_world_items, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            updatedAt,
          );
      }

      this.db
        .prepare("DELETE FROM chapters_fts WHERE chapter_id = ?")
        .run(chapterId);
      this.db
        .prepare(
          `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
          VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          input.projectId,
          chapterId,
          input.title,
          input.summary ?? "",
          input.content,
        );

      const updateCharacterAppearance = this.db.prepare(
        `UPDATE characters
        SET first_appearance_chapter = COALESCE(first_appearance_chapter, ?),
            last_appearance_chapter = CASE
              WHEN last_appearance_chapter IS NULL OR last_appearance_chapter < ? THEN ?
              ELSE last_appearance_chapter
            END,
            updated_at = ?
        WHERE id = ? AND project_id = ?`,
      );

      involvedCharacters.forEach((characterId) => {
        updateCharacterAppearance.run(
          input.chapterIndex,
          input.chapterIndex,
          input.chapterIndex,
          updatedAt,
          characterId,
          input.projectId,
        );
      });

      this.db
        .prepare(
          `UPDATE chapter_outlines
          SET status = 'written', updated_at = ?
          WHERE project_id = ? AND chapter_index = ?`,
        )
        .run(updatedAt, input.projectId, input.chapterIndex);

      this.db
        .prepare(
          `INSERT INTO canon_facts (
            id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
          ) VALUES (?, ?, 'chapter', ?, 'chapter_summary', ?, 0.88, 3, ?, ?)`,
        )
        .run(
          createId("canon"),
          input.projectId,
          chapterId,
          input.summary ??
            `${input.title}：${excerptStart(input.content, 80) ?? ""}`,
          updatedAt,
          updatedAt,
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
      .prepare(
        "SELECT * FROM chapters WHERE project_id = ? AND chapter_index = ?",
      )
      .get(projectId, chapterIndex) as Record<string, unknown> | undefined;

    return row ? mapChapterRow(row) : null;
  }

  listChapters(projectId: string): Chapter[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM chapters WHERE project_id = ? ORDER BY chapter_index ASC",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapChapterRow);
  }

  getRecentChapters(input: GetRecentChaptersInput): Chapter[] {
    this.projectService.ensureProjectExists(input.projectId);
    const limit = input.limit ?? 5;

    const rows = (
      input.beforeChapterIndex
        ? this.db
            .prepare(
              `SELECT * FROM chapters
            WHERE project_id = ? AND chapter_index < ?
            ORDER BY chapter_index DESC
            LIMIT ?`,
            )
            .all(input.projectId, input.beforeChapterIndex, limit)
        : this.db
            .prepare(
              `SELECT * FROM chapters
            WHERE project_id = ?
            ORDER BY chapter_index DESC
            LIMIT ?`,
            )
            .all(input.projectId, limit)
    ) as Record<string, unknown>[];

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
        includeContent: false,
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
          LIMIT ?`,
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
        LIMIT ?`,
      )
      .all(projectId, like, like, like, limit) as Record<string, unknown>[];

    return rows.map(mapChapterRow);
  }

  updateChapterSummary(input: UpdateChapterSummaryInput): Chapter {
    const current = this.getChapter(input.projectId, input.chapterId);
    const updatedAt = nowIso();

    this.db
      .prepare(
        "UPDATE chapters SET summary = ?, updated_at = ? WHERE id = ? AND project_id = ?",
      )
      .run(input.summary, updatedAt, input.chapterId, input.projectId);

    this.db
      .prepare("DELETE FROM chapters_fts WHERE chapter_id = ?")
      .run(input.chapterId);
    this.db
      .prepare(
        `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        input.chapterId,
        current.title,
        input.summary,
        current.content,
      );

    return this.getChapter(input.projectId, input.chapterId);
  }

  reviewChapterQuality(input: ReviewChapterQualityInput): ChapterQualityReview {
    const project = this.projectService.getProject(input.projectId);
    const wordCount = countWords(input.content);
    const sceneCount = countScenes(input.content);
    const conflictProgressionScore = scoreConflictProgression(input.content);
    const endingHookScore = scoreEndingHook(input.content, input.hook);
    const aiExpressionScore = scoreAiExpression(input.content);
    const summaryRatio = calculateSummaryRatio(input.content);
    const issues: ChapterQualityIssue[] = [];

    if (project.minChapterWords && wordCount < project.minChapterWords) {
      issues.push({
        type: "too_short",
        severity: "high",
        message: `章节字数 ${wordCount} 低于最低门槛 ${project.minChapterWords}。`,
      });
    }
    if (project.maxChapterWords && wordCount > project.maxChapterWords) {
      issues.push({
        type: "too_long",
        severity: "medium",
        message: `章节字数 ${wordCount} 高于建议上限 ${project.maxChapterWords}。`,
      });
    }
    if (sceneCount < 4) {
      issues.push({
        type: "too_few_scenes",
        severity: "medium",
        message: `识别到 ${sceneCount} 个场景，建议至少 4-6 个完整场景。`,
      });
    }
    if (conflictProgressionScore < 50) {
      issues.push({
        type: "weak_conflict",
        severity: "medium",
        message: "冲突推进偏弱，缺少行动、阻力升级或明确代价。",
      });
    }
    if (endingHookScore < 50) {
      issues.push({
        type: "weak_hook",
        severity: "medium",
        message: "结尾钩子偏弱，建议留下新信息、新危险或明确悬念。",
      });
    }
    if (aiExpressionScore >= 60) {
      issues.push({
        type: "ai_like_expression",
        severity: "medium",
        message: "检测到较多模板化或总结式 AI 腔表达。",
      });
    }
    if (summaryRatio >= 0.35) {
      issues.push({
        type: "summary_over_plot",
        severity: "high",
        message: "总结化比例过高，可能用概述代替了具体剧情。",
      });
    }

    const allowShortReasonRequired = issues.some(
      (issue) => issue.type === "too_short",
    );

    return {
      ok: !issues.some((issue) => issue.severity === "high"),
      wordCount,
      chapterWordTarget: project.chapterWordTarget,
      minChapterWords: project.minChapterWords,
      maxChapterWords: project.maxChapterWords,
      sceneCount,
      conflictProgressionScore,
      endingHookScore,
      aiExpressionScore,
      summaryRatio,
      issues,
      allowShortReasonRequired,
    };
  }

  expandChapterPrompt(input: ExpandChapterPromptInput): string {
    const project = this.projectService.getProject(input.projectId);
    const review = this.reviewChapterQuality({
      projectId: input.projectId,
      chapterIndex: input.chapterIndex,
      title: input.title,
      content: input.content,
    });
    const target =
      project.chapterWordTarget ??
      project.minChapterWords ??
      Math.max(review.wordCount + 1200, 3500);
    const minWords = project.minChapterWords ?? Math.max(1200, target - 500);

    return [
      "请扩写下面这一章，必须直接输出小说正文，不要输出大纲、分析、解释或提示词。",
      `目标：扩写到约 ${target} 中文字，最低不得低于 ${minWords} 中文字。`,
      "硬性要求：保留原剧情走向和关键事实；增加完整场景、对白、动作、心理、环境细节和冲突升级；不得水字数，不得用总结代替剧情。",
      "结构要求：至少 4-6 个完整场景，包含承接上一章、主角行动、阻力升级、人物变化、结尾钩子。",
      "风格要求：减少模板化表达，人物说话要有差异，冲突必须落到具体行动和选择。",
      input.currentIssues?.length
        ? `当前问题：${input.currentIssues.join("；")}`
        : `当前审核：${JSON.stringify(review, null, 2)}`,
      `章节标题：${input.title ?? `第 ${input.chapterIndex ?? "?"} 章`}`,
      "原章节正文：",
      input.content,
    ].join("\n\n");
  }
}

function countScenes(content: string): number {
  const explicitScenes = content
    .split(/\n\s*(?:-{3,}|\*{3,}|#{2,}|第[一二三四五六七八九十\d]+场|场景[一二三四五六七八九十\d]+)\s*\n/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (explicitScenes.length > 1) {
    return explicitScenes.length;
  }

  const paragraphs = content
    .split(/\n+/u)
    .map((part) => part.trim())
    .filter((part) => countWords(part) >= 30);
  return Math.max(1, Math.ceil(paragraphs.length / 4));
}

function scoreConflictProgression(content: string): number {
  const actionHits = countPattern(content, /冲|追|挡|拦|逼|夺|逃|打|问|查|闯|救|杀|争|抢/gu);
  const resistanceHits = countPattern(
    content,
    /但是|然而|偏偏|阻止|代价|威胁|危险|失败|暴露|陷阱|反击|拒绝|怀疑/gu,
  );
  const changeHits = countPattern(
    content,
    /终于|意识到|决定|改变|失去|得到|发现|揭开|承认|背叛|选择/gu,
  );
  return Math.min(100, actionHits * 4 + resistanceHits * 8 + changeHits * 8);
}

function scoreEndingHook(content: string, hook?: string): number {
  const ending = excerptEnd(content, 180) ?? "";
  const text = `${ending}\n${hook ?? ""}`;
  const hookHits = countPattern(
    text,
    /？|吗|谁|为何|突然|只见|门外|身后|下一刻|真相|秘密|血|响|裂|来了|名字/gu,
  );
  return Math.min(100, hookHits * 20 + (hook?.trim() ? 30 : 0));
}

function scoreAiExpression(content: string): number {
  const hits = countPattern(
    content,
    /总而言之|与此同时|不可否认|值得一提的是|他知道.*必须|一种.*感觉|复杂的情绪|内心深处|命运的齿轮|空气仿佛凝固/gu,
  );
  return Math.min(100, hits * 18);
}

function calculateSummaryRatio(content: string): number {
  const sentences = content
    .split(/[。！？!?]/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length === 0) {
    return 0;
  }

  const summaryCount = sentences.filter((sentence) =>
    /经过|随后|于是|最终|很快|一番|开始|继续|决定|意识到|明白了|想起了/u.test(
      sentence,
    ),
  ).length;
  return Number((summaryCount / sentences.length).toFixed(2));
}

function countPattern(content: string, pattern: RegExp): number {
  return [...content.matchAll(pattern)].length;
}
