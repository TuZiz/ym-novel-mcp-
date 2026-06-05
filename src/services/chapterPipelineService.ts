import type Database from "better-sqlite3";
import type {
  ApplyPostChapterUpdateInput,
  ApplyPostChapterUpdateResult,
  ApplyPostChapterUpdateWarning,
  BuildPostChapterUpdatePromptInput,
  CanonFact,
  Chapter,
  Character,
  OutlineSuggestion,
  PlanNextChapterInput,
  PlanNextChapterResult,
} from "../types/novel.js";
import { AppError } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { patchValue } from "../utils/patch.js";
import { mapCanonFactRow } from "../utils/rows.js";
import { nowIso } from "../utils/text.js";
import { ChapterService } from "./chapterService.js";
import { CharacterService } from "./characterService.js";
import { ForeshadowingService } from "./foreshadowingService.js";
import { ProjectService } from "./projectService.js";
import { SearchService } from "./searchService.js";
import { TimelineService } from "./timelineService.js";
import { WorldService } from "./worldService.js";
import { WritingContextService } from "./writingContextService.js";

export class ChapterPipelineService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly chapterService: ChapterService,
    private readonly writingContextService: WritingContextService,
    private readonly characterService: CharacterService,
    private readonly worldService: WorldService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly timelineService: TimelineService,
    private readonly searchService: SearchService,
  ) {}

  planNextChapter(input: PlanNextChapterInput): PlanNextChapterResult {
    const context = this.writingContextService.buildNextChapterContext({
      ...input,
      recentChapterLimit: 5,
    });
    const previousChapter = context.recentChapters.at(-1) ?? null;
    const outlineSuggestion: OutlineSuggestion = {
      title:
        context.chapterOutline?.title ??
        `第 ${input.chapterIndex} 章 ${input.focus ?? "承接余波"}`,
      goal:
        context.chapterOutline?.goal ??
        input.focus ??
        previousChapter?.hook ??
        context.currentVolume?.goal ??
        "承接上一章结尾，推动当前主线冲突前进一小步。",
      conflict:
        context.chapterOutline?.conflict ??
        context.currentVolume?.conflict ??
        "主角想推进目标，但既有阻力、信息差或未回收伏笔制造新的障碍。",
      keyEvents: this.buildKeyEvents(
        input,
        context,
        previousChapter?.hook ?? null,
      ),
      requiredCharacters: this.buildRequiredCharacters(context),
      requiredForeshadowing: this.buildRequiredForeshadowing(context),
      endingHook:
        context.chapterOutline?.endingHook ??
        this.buildEndingHook(input, context, previousChapter?.hook ?? null),
    };
    const instruction = [
      `请为《${context.project.name}》第 ${input.chapterIndex} 章撰写详细正文前大纲。`,
      "不要调用外部资料，不要改写既有设定，不要跳过上一章钩子。",
      "优先使用 outlineSuggestion 作为章节骨架，并参考 context 中的最近章节、人物状态、世界观规则、未回收伏笔和写作规则。",
      input.focus ? `本章聚焦：${input.focus}` : null,
      "输出时保持结构清晰：章节目标、冲突推进、关键事件、人物状态变化、结尾钩子。",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    return {
      outlineSuggestion,
      context,
      instruction,
    };
  }

  applyPostChapterUpdate(
    input: ApplyPostChapterUpdateInput,
  ): ApplyPostChapterUpdateResult {
    this.projectService.ensureProjectExists(input.projectId);
    const chapter = this.chapterService.getChapterByIndex(
      input.projectId,
      input.chapterIndex,
    );
    if (!chapter) {
      throw new AppError(
        `Chapter ${input.chapterIndex} not found.`,
        "NOT_FOUND",
      );
    }

    let updatedChapter: Chapter | undefined;
    const updatedCharacters: Character[] = [];
    const addedWorldItems: ApplyPostChapterUpdateResult["addedWorldItems"] = [];
    const addedForeshadowings: ApplyPostChapterUpdateResult["addedForeshadowings"] =
      [];
    const resolvedForeshadowings: ApplyPostChapterUpdateResult["resolvedForeshadowings"] =
      [];
    const addedTimelineEvents: ApplyPostChapterUpdateResult["addedTimelineEvents"] =
      [];
    const addedCanonFacts: CanonFact[] = [];
    const warnings: ApplyPostChapterUpdateWarning[] = [];

    const transaction = this.db.transaction(() => {
      if (
        input.update.summary !== undefined ||
        input.update.hook !== undefined
      ) {
        this.updateChapterAfterPostProcess(
          chapter,
          input.update.summary,
          input.update.hook,
        );
        updatedChapter = this.chapterService.getChapter(
          input.projectId,
          chapter.id,
        );
      }

      for (const update of input.update.characterUpdates ?? []) {
        const character = this.resolveCharacterForUpdate(
          input.projectId,
          update,
          warnings,
        );
        if (!character) {
          continue;
        }

        this.updateCharacterFromPostProcess(character, update);
        updatedCharacters.push(
          this.characterService.getCharacter(input.projectId, character.id),
        );
      }

      for (const item of input.update.newWorldItems ?? []) {
        addedWorldItems.push(
          this.worldService.addWorldItem({
            projectId: input.projectId,
            ...item,
          }),
        );
      }

      for (const item of input.update.newForeshadowings ?? []) {
        addedForeshadowings.push(
          this.foreshadowingService.addForeshadowing({
            projectId: input.projectId,
            introducedChapterId: chapter.id,
            ...item,
          }),
        );
      }

      for (const item of input.update.resolvedForeshadowings ?? []) {
        try {
          resolvedForeshadowings.push(
            this.foreshadowingService.resolveForeshadowing({
              projectId: input.projectId,
              foreshadowingId: item.foreshadowingId,
              resolvedChapterId: item.resolvedChapterId ?? chapter.id,
              notes: item.notes,
            }),
          );
        } catch (error) {
          if (error instanceof AppError && error.code === "NOT_FOUND") {
            warnings.push({
              type: "foreshadowing_not_found",
              severity: "medium",
              message: `Foreshadowing ${item.foreshadowingId} was not found and was not resolved.`,
            });
            continue;
          }

          throw error;
        }
      }

      let nextEventOrder = this.getNextTimelineEventOrder(input.projectId);
      for (const event of input.update.timelineEvents ?? []) {
        const eventOrder = event.eventOrder ?? nextEventOrder;
        nextEventOrder = Math.max(nextEventOrder, eventOrder + 1);
        addedTimelineEvents.push(
          this.timelineService.addTimelineEvent({
            projectId: input.projectId,
            chapterId: chapter.id,
            eventOrder,
            title: event.title,
            description: event.description,
            involvedCharacters: event.involvedCharacters,
            location: event.location,
            impact: event.impact,
          }),
        );
      }

      for (const fact of input.update.canonFacts ?? []) {
        addedCanonFacts.push(
          this.addCanonFact(input.projectId, chapter.id, fact),
        );
      }
    });

    transaction();

    return {
      ok: warnings.every((warning) => warning.severity !== "high"),
      updatedChapter,
      updatedCharacters,
      addedWorldItems,
      addedForeshadowings,
      resolvedForeshadowings,
      addedTimelineEvents,
      addedCanonFacts,
      warnings,
    };
  }

  buildPostChapterUpdatePrompt(
    input: BuildPostChapterUpdatePromptInput,
  ): string {
    const project = this.projectService.getProject(input.projectId);
    const chapter = this.chapterService.getChapterByIndex(
      input.projectId,
      input.chapterIndex,
    );

    if (!chapter) {
      throw new AppError(
        `Chapter ${input.chapterIndex} not found.`,
        "NOT_FOUND",
      );
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "chapterSummary",
        "characterStateChanges",
        "characterLocationChanges",
        "newForeshadowings",
        "resolvedForeshadowings",
        "newWorldFacts",
        "timelineEvents",
        "nextChapterHook",
      ],
      properties: {
        chapterSummary: {
          type: "string",
          description: "120-200 字中文摘要，保留关键冲突、推进结果和结尾钩子。",
        },
        characterStateChanges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["characterName", "before", "after", "evidence"],
            properties: {
              characterName: { type: "string" },
              before: { type: ["string", "null"] },
              after: { type: "string" },
              evidence: { type: "string" },
            },
          },
        },
        characterLocationChanges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["characterName", "from", "to", "evidence"],
            properties: {
              characterName: { type: "string" },
              from: { type: ["string", "null"] },
              to: { type: "string" },
              evidence: { type: "string" },
            },
          },
        },
        newForeshadowings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description", "importance", "evidence"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              importance: { type: "integer", minimum: 1, maximum: 5 },
              evidence: { type: "string" },
            },
          },
        },
        resolvedForeshadowings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "resolution", "status", "evidence"],
            properties: {
              title: { type: "string" },
              resolution: { type: "string" },
              status: {
                type: "string",
                enum: ["partially_resolved", "resolved", "abandoned"],
              },
              evidence: { type: "string" },
            },
          },
        },
        newWorldFacts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "name", "content", "importance", "evidence"],
            properties: {
              type: { type: "string" },
              name: { type: "string" },
              content: { type: "string" },
              importance: { type: "integer", minimum: 1, maximum: 5 },
              evidence: { type: "string" },
            },
          },
        },
        timelineEvents: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "eventOrderHint",
              "title",
              "description",
              "location",
              "impact",
            ],
            properties: {
              eventOrderHint: { type: "integer" },
              title: { type: "string" },
              description: { type: "string" },
              location: { type: ["string", "null"] },
              impact: { type: ["string", "null"] },
            },
          },
        },
        nextChapterHook: {
          type: "string",
          description: "下一章必须承接的悬念或行动压力。",
        },
      },
    };

    return [
      `你是《${project.name}》的长篇小说资料整理助手。`,
      `请阅读第 ${chapter.chapterIndex} 章《${chapter.title}》正文，从中抽取可写入本地 MCP 数据库的结构化更新。`,
      "只依据章节正文，不要发明正文没有出现的事实；不确定的内容请不要输出。",
      "必须返回严格 JSON，不要 Markdown，不要解释。",
      `JSON Schema:\n${JSON.stringify(schema, null, 2)}`,
      `章节正文:\n${chapter.content}`,
    ].join("\n\n");
  }

  private updateChapterAfterPostProcess(
    chapter: Chapter,
    summary: string | undefined,
    hook: string | undefined,
  ): void {
    const updatedAt = nowIso();
    const nextSummary = patchValue(summary, chapter.summary);
    const nextHook = patchValue(hook, chapter.hook);

    this.db
      .prepare(
        `UPDATE chapters
        SET summary = ?, hook = ?, updated_at = ?
        WHERE project_id = ? AND id = ?`,
      )
      .run(nextSummary, nextHook, updatedAt, chapter.projectId, chapter.id);

    this.db
      .prepare("DELETE FROM chapters_fts WHERE chapter_id = ?")
      .run(chapter.id);
    this.db
      .prepare(
        `INSERT INTO chapters_fts (project_id, chapter_id, title, summary, content)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        chapter.projectId,
        chapter.id,
        chapter.title,
        nextSummary ?? "",
        chapter.content,
      );
  }

  private resolveCharacterForUpdate(
    projectId: string,
    update: NonNullable<
      ApplyPostChapterUpdateInput["update"]["characterUpdates"]
    >[number],
    warnings: ApplyPostChapterUpdateWarning[],
  ): Character | null {
    if (update.characterId) {
      try {
        return this.characterService.getCharacter(
          projectId,
          update.characterId,
        );
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_FOUND") {
          warnings.push({
            type: "character_not_found",
            severity: "medium",
            message: `Character ${update.characterId} was not found and was not updated.`,
          });
          return null;
        }

        throw error;
      }
    }

    if (!update.name) {
      warnings.push({
        type: "character_reference_missing",
        severity: "medium",
        message: "Character update did not include characterId or name.",
      });
      return null;
    }

    const matches = this.searchService
      .resolveCharacters(projectId, [update.name])
      .filter((character) => character.name === update.name);
    if (matches.length === 0) {
      warnings.push({
        type: "character_name_not_found",
        severity: "medium",
        message: `Character named ${update.name} was not found and was not created automatically.`,
      });
      return null;
    }

    if (matches.length > 1) {
      warnings.push({
        type: "multiple_character_name_matches",
        severity: "low",
        message: `Multiple characters named ${update.name} were found; the first match was updated.`,
      });
    }

    return matches[0] ?? null;
  }

  private updateCharacterFromPostProcess(
    character: Character,
    update: NonNullable<
      ApplyPostChapterUpdateInput["update"]["characterUpdates"]
    >[number],
  ): void {
    this.db
      .prepare(
        `UPDATE characters
        SET current_state = ?, power_level = ?, location = ?, status = ?,
            relationship_summary = ?, last_appearance_chapter = ?, updated_at = ?
        WHERE project_id = ? AND id = ?`,
      )
      .run(
        patchValue(update.currentState, character.currentState),
        patchValue(update.powerLevel, character.powerLevel),
        patchValue(update.location, character.location),
        patchValue(update.status, character.status),
        patchValue(update.relationshipSummary, character.relationshipSummary),
        patchValue(
          update.lastAppearanceChapter,
          character.lastAppearanceChapter,
        ),
        nowIso(),
        character.projectId,
        character.id,
      );
  }

  private getNextTimelineEventOrder(projectId: string): number {
    const row = this.db
      .prepare(
        "SELECT COALESCE(MAX(event_order), -1) + 1 AS nextOrder FROM timeline_events WHERE project_id = ?",
      )
      .get(projectId) as { nextOrder: number };

    return Number(row.nextOrder);
  }

  private addCanonFact(
    projectId: string,
    chapterId: string,
    input: NonNullable<
      ApplyPostChapterUpdateInput["update"]["canonFacts"]
    >[number],
  ): CanonFact {
    const now = nowIso();
    const sourceType = input.sourceType ?? "chapter";
    const sourceId = sourceType === "chapter" ? chapterId : null;
    const id = createId("canon");

    this.db
      .prepare(
        `INSERT INTO canon_facts (
          id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        sourceType,
        sourceId,
        input.factType,
        input.content,
        input.confidence ?? 0.8,
        input.importance ?? 3,
        now,
        now,
      );

    const row = this.db
      .prepare("SELECT * FROM canon_facts WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return mapCanonFactRow(row);
  }

  private buildKeyEvents(
    input: PlanNextChapterInput,
    context: PlanNextChapterResult["context"],
    previousHook: string | null,
  ): string[] {
    const outlined = splitEvents(context.chapterOutline?.keyEvents ?? null);
    if (outlined.length > 0) {
      return outlined;
    }

    return [
      previousHook ? `承接上一章钩子：${previousHook}` : null,
      input.focus ? `围绕“${input.focus}”制造直接行动目标。` : null,
      context.currentVolume?.goal
        ? `让当前卷目标继续显性推进：${context.currentVolume.goal}`
        : null,
      context.openForeshadowings[0]
        ? `轻触或推进伏笔：${context.openForeshadowings[0].title}`
        : null,
      "结尾留下一个会迫使角色立刻选择的钩子。",
    ].filter((event): event is string => Boolean(event));
  }

  private buildRequiredCharacters(
    context: PlanNextChapterResult["context"],
  ): string[] {
    if (context.chapterOutline?.requiredCharacters.length) {
      return context.chapterOutline.requiredCharacters;
    }

    return context.relevantCharacters
      .slice(0, 5)
      .map((character) => character.name);
  }

  private buildRequiredForeshadowing(
    context: PlanNextChapterResult["context"],
  ): string[] {
    if (context.chapterOutline?.requiredForeshadowing.length) {
      return context.chapterOutline.requiredForeshadowing;
    }

    return context.openForeshadowings.slice(0, 3).map((item) => item.title);
  }

  private buildEndingHook(
    input: PlanNextChapterInput,
    context: PlanNextChapterResult["context"],
    previousHook: string | null,
  ): string {
    if (context.openForeshadowings[0]) {
      return `让“${context.openForeshadowings[0].title}”出现新的证据，但不完全解释。`;
    }

    if (input.focus) {
      return `围绕“${input.focus}”抛出新的阻碍或反转。`;
    }

    return previousHook
      ? `上一章钩子“${previousHook}”得到回应后，引出更大的问题。`
      : "以新的危险、线索或人物选择结束，确保下一章必须承接。";
  }
}

function splitEvents(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n|[;；。]/u)
    .map((event) => event.trim())
    .filter(Boolean);
}
