import type Database from "better-sqlite3";
import type {
  ExperienceRecord,
  ExperienceSearchResultItem,
  ExperienceType,
  FeedbackEvent,
  GetLearningContextInput,
  LearningContext,
  LearningContextItem,
  PromoteExperienceInput,
  RecordExperienceInput,
  RecordFeedbackInput,
  RecordWorkflowRunInput,
  SearchExperiencesInput,
  SearchExperiencesResult,
  SuppressExperienceInput,
  WorkflowRun,
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import {
  mapExperienceRecordRow,
  mapFeedbackEventRow,
  mapWorkflowRunRow,
} from "../utils/rows.js";
import { compactText, nowIso } from "../utils/text.js";
import { ProjectService } from "./projectService.js";

type SqlParam = string | number | null;

const contextTypes = {
  bestPractices: [
    "best_practice",
    "successful_solution",
    "correction",
  ] satisfies ExperienceType[],
  avoidPatterns: [
    "avoid_pattern",
    "failed_solution",
  ] satisfies ExperienceType[],
  userPreferences: ["user_preference"] satisfies ExperienceType[],
  styleRules: ["style_rule"] satisfies ExperienceType[],
  workflowRules: ["workflow_rule"] satisfies ExperienceType[],
  canonDecisions: ["canon_decision"] satisfies ExperienceType[],
} as const;

const feedbackExperienceTargets = new Set([
  "experience",
  "experience_record",
  "learning_memory",
]);
const positiveFeedbackActions = new Set(["accepted", "good_result"]);
const negativeFeedbackActions = new Set(["rejected", "bad_result"]);
const inactiveScoreThreshold = -5;
const denialMarkers = [
  "不再",
  "并非",
  "不是",
  "没有",
  "从未",
  "不存在",
  "推翻",
  "否定",
  "是假的",
  "被推翻",
];

export class LearningMemoryService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
  ) {}

  recordExperience(input: RecordExperienceInput): ExperienceRecord {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const now = nowIso();
    const id = createId("exp");

    this.db
      .prepare(
        `INSERT INTO experience_records (
          id, project_id, scope, type, title, content, reason, tags, source_type, source_id,
          confidence, score, usage_count, last_used_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 'active', ?, ?)`,
      )
      .run(
        id,
        input.projectId ?? null,
        input.scope,
        input.type,
        input.title,
        input.content,
        input.reason ?? null,
        JSON.stringify(input.tags ?? []),
        input.sourceType ?? null,
        input.sourceId ?? null,
        clamp(input.confidence ?? 0.8, 0, 1),
        now,
        now,
      );

    return this.getExperience(id);
  }

  getExperience(experienceId: string): ExperienceRecord {
    const row = this.db
      .prepare("SELECT * FROM experience_records WHERE id = ?")
      .get(experienceId) as Record<string, unknown> | undefined;

    return mapExperienceRecordRow(
      assertFound(row, `Experience ${experienceId} not found.`),
    );
  }

  searchExperiences(input: SearchExperiencesInput): SearchExperiencesResult {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const params: Record<string, SqlParam> = {
      query: input.query,
      likeQuery: `%${input.query.trim()}%`,
      projectId: input.projectId ?? null,
      limit: normalizeLimit(input.limit, 10, 50),
    };
    const conditions = ["status = 'active'"];

    if (input.projectId) {
      conditions.push("(project_id = @projectId OR project_id IS NULL)");
    }
    if (input.query.trim()) {
      conditions.push(
        "(title LIKE @likeQuery OR content LIKE @likeQuery OR COALESCE(reason, '') LIKE @likeQuery OR tags LIKE @likeQuery)",
      );
    }
    if (input.scope) {
      params.scope = input.scope;
      conditions.push("scope = @scope");
    }
    if (input.type) {
      params.type = input.type;
      conditions.push("type = @type");
    }
    input.tags?.forEach((tag, index) => {
      params[`tag${index}`] = `%${tag}%`;
      conditions.push(`tags LIKE @tag${index}`);
    });

    const rows = this.db
      .prepare(
        `SELECT * FROM experience_records
        WHERE ${conditions.join(" AND ")}
        ORDER BY
          CASE
            WHEN @projectId IS NOT NULL AND project_id = @projectId THEN 0
            WHEN project_id IS NULL THEN 1
            ELSE 2
          END ASC,
          score DESC,
          confidence DESC,
          usage_count DESC,
          updated_at DESC
        LIMIT @limit`,
      )
      .all(params) as Record<string, unknown>[];

    return {
      query: input.query,
      results: rows.map(mapExperienceRecordRow).map(toSearchResultItem),
    };
  }

  recordFeedback(input: RecordFeedbackInput): FeedbackEvent {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const feedback = this.insertFeedbackEvent({
      projectId: input.projectId ?? null,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      rating: input.rating ?? null,
      feedback: input.feedback,
      action: input.action ?? null,
    });

    if (
      input.targetId &&
      feedbackExperienceTargets.has(input.targetType) &&
      input.action &&
      positiveFeedbackActions.has(input.action)
    ) {
      this.adjustExperienceScore(input.targetId, 1, false);
    }

    if (
      input.targetId &&
      feedbackExperienceTargets.has(input.targetType) &&
      input.action &&
      negativeFeedbackActions.has(input.action)
    ) {
      this.adjustExperienceScore(input.targetId, -1, true);
    }

    return feedback;
  }

  promoteExperience(input: PromoteExperienceInput): ExperienceRecord {
    const amount = normalizeAmount(input.amount);
    const current = this.getExperience(input.experienceId);
    const nextConfidence = Math.min(1, current.confidence + amount * 0.03);

    this.db
      .prepare(
        `UPDATE experience_records
        SET score = score + ?, confidence = ?, status = 'active', updated_at = ?
        WHERE id = ?`,
      )
      .run(amount, nextConfidence, nowIso(), input.experienceId);

    if (input.reason?.trim()) {
      this.insertFeedbackEvent({
        projectId: current.projectId,
        targetType: "experience",
        targetId: current.id,
        rating: null,
        feedback: input.reason,
        action: "good_result",
      });
    }

    return this.getExperience(input.experienceId);
  }

  suppressExperience(input: SuppressExperienceInput): ExperienceRecord {
    const amount = normalizeAmount(input.amount);
    const current = this.getExperience(input.experienceId);
    const nextScore = current.score - amount;
    const nextStatus =
      nextScore <= inactiveScoreThreshold ? "inactive" : current.status;

    this.db
      .prepare(
        `UPDATE experience_records
        SET score = ?, status = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(nextScore, nextStatus, nowIso(), input.experienceId);

    if (input.reason?.trim()) {
      this.insertFeedbackEvent({
        projectId: current.projectId,
        targetType: "experience",
        targetId: current.id,
        rating: null,
        feedback: input.reason,
        action: "bad_result",
      });
    }

    return this.getExperience(input.experienceId);
  }

  getLearningContext(input: GetLearningContextInput): LearningContext {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const limit = normalizeLimit(input.limit, 6, 20);
    const query = compactText(
      input.query ?? null,
      input.focus ?? null,
      input.chapterIndex === undefined ? null : `第 ${input.chapterIndex} 章`,
    );
    const bestPractices = this.pickContextItems(
      input.projectId,
      contextTypes.bestPractices,
      query,
      limit,
    );
    const avoidPatterns = this.pickContextItems(
      input.projectId,
      contextTypes.avoidPatterns,
      query,
      limit,
    );
    const userPreferences = this.pickContextItems(
      input.projectId,
      contextTypes.userPreferences,
      query,
      limit,
    );
    const styleRules = this.pickContextItems(
      input.projectId,
      contextTypes.styleRules,
      query,
      limit,
    );
    const workflowRules = this.pickContextItems(
      input.projectId,
      contextTypes.workflowRules,
      query,
      limit,
    );
    const canonDecisions = this.pickContextItems(
      input.projectId,
      contextTypes.canonDecisions,
      query,
      limit,
    );

    const allItems = [
      ...bestPractices,
      ...avoidPatterns,
      ...userPreferences,
      ...styleRules,
      ...workflowRules,
      ...canonDecisions,
    ];
    this.markExperiencesUsed(allItems);

    return {
      bestPractices,
      avoidPatterns,
      userPreferences,
      styleRules,
      workflowRules,
      canonDecisions,
      instruction: buildLearningInstruction({
        bestPractices,
        avoidPatterns,
        userPreferences,
        styleRules,
        workflowRules,
        canonDecisions,
      }),
    };
  }

  recordWorkflowRun(input: RecordWorkflowRunInput): WorkflowRun {
    this.projectService.ensureProjectExists(input.projectId);
    const id = createId("workflow");
    const createdAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO workflow_runs (
          id, project_id, workflow_type, input_summary, output_summary, result, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.workflowType,
        input.inputSummary ?? null,
        input.outputSummary ?? null,
        input.result,
        input.notes ?? null,
        createdAt,
      );

    const row = this.db
      .prepare("SELECT * FROM workflow_runs WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return mapWorkflowRunRow(row);
  }

  findDraftRisks(
    projectId: string,
    draftContent: string,
    type: ExperienceType,
    limit = 8,
  ): ExperienceRecord[] {
    this.projectService.ensureProjectExists(projectId);
    const candidates = this.listActiveExperiences(
      projectId,
      [type],
      Math.max(limit * 10, 50),
    );

    return candidates
      .filter((record) => {
        if (type === "canon_decision") {
          return conflictsWithCanonDecision(record, draftContent);
        }

        return matchesExperienceDraft(record, draftContent);
      })
      .slice(0, limit);
  }

  private pickContextItems(
    projectId: string | undefined,
    types: readonly ExperienceType[],
    query: string,
    limit: number,
  ): LearningContextItem[] {
    const records = this.listActiveExperiences(projectId, types, 200);
    const terms = extractQueryTerms(query);
    const scored = records.map((record) => ({
      record,
      relevance: calculateRelevance(record, terms),
    }));
    const hasRelevantItems =
      terms.length > 0 && scored.some((item) => item.relevance > 0);
    const pool = hasRelevantItems
      ? scored.filter((item) => item.relevance > 0)
      : scored;

    return pool
      .sort((left, right) => {
        const relevanceDelta = right.relevance - left.relevance;
        if (relevanceDelta !== 0) {
          return relevanceDelta;
        }

        return compareExperienceRecords(left.record, right.record, projectId);
      })
      .slice(0, limit)
      .map((item) => toLearningContextItem(item.record));
  }

  private listActiveExperiences(
    projectId: string | undefined,
    types: readonly ExperienceType[],
    limit: number,
  ): ExperienceRecord[] {
    const params: Record<string, SqlParam> = {
      projectId: projectId ?? null,
      limit,
    };
    const typePlaceholders = types.map((type, index) => {
      params[`type${index}`] = type;
      return `@type${index}`;
    });
    const projectCondition = projectId
      ? "AND (project_id = @projectId OR project_id IS NULL)"
      : "";

    const rows = this.db
      .prepare(
        `SELECT * FROM experience_records
        WHERE status = 'active'
          ${projectCondition}
          AND type IN (${typePlaceholders.join(", ")})
        ORDER BY
          CASE
            WHEN @projectId IS NOT NULL AND project_id = @projectId THEN 0
            WHEN project_id IS NULL THEN 1
            ELSE 2
          END ASC,
          score DESC,
          confidence DESC,
          usage_count DESC,
          updated_at DESC
        LIMIT @limit`,
      )
      .all(params) as Record<string, unknown>[];

    return rows.map(mapExperienceRecordRow);
  }

  private insertFeedbackEvent(input: {
    projectId: string | null;
    targetType: string;
    targetId: string | null;
    rating: number | null;
    feedback: string;
    action: FeedbackEvent["action"];
  }): FeedbackEvent {
    const id = createId("feedback");
    const createdAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO feedback_events (
          id, project_id, target_type, target_id, rating, feedback, action, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.targetType,
        input.targetId,
        input.rating,
        input.feedback,
        input.action,
        createdAt,
      );

    const row = this.db
      .prepare("SELECT * FROM feedback_events WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return mapFeedbackEventRow(row);
  }

  private adjustExperienceScore(
    experienceId: string,
    delta: number,
    allowInactive: boolean,
  ): void {
    const row = this.db
      .prepare("SELECT score FROM experience_records WHERE id = ?")
      .get(experienceId) as { score: number } | undefined;

    if (!row) {
      return;
    }

    const nextScore = Number(row.score) + delta;
    const nextStatus =
      allowInactive && nextScore <= inactiveScoreThreshold
        ? "inactive"
        : "active";

    this.db
      .prepare(
        `UPDATE experience_records
        SET score = ?, status = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(nextScore, nextStatus, nowIso(), experienceId);
  }

  private markExperiencesUsed(items: LearningContextItem[]): void {
    if (items.length === 0) {
      return;
    }

    const updateUsage = this.db.prepare(
      `UPDATE experience_records
      SET usage_count = usage_count + 1, last_used_at = ?
      WHERE id = ?`,
    );
    const now = nowIso();
    const transaction = this.db.transaction(
      (records: LearningContextItem[]) => {
        for (const item of records) {
          updateUsage.run(now, item.id);
          item.usageCount += 1;
        }
      },
    );

    transaction(items);
  }
}

function toSearchResultItem(
  record: ExperienceRecord,
): ExperienceSearchResultItem {
  return {
    id: record.id,
    scope: record.scope,
    type: record.type,
    title: record.title,
    content: record.content,
    ...(record.reason ? { reason: record.reason } : {}),
    tags: record.tags,
    confidence: record.confidence,
    score: record.score,
    usageCount: record.usageCount,
  };
}

function toLearningContextItem(record: ExperienceRecord): LearningContextItem {
  return {
    ...toSearchResultItem(record),
    projectId: record.projectId,
  };
}

function buildLearningInstruction(
  input: Omit<LearningContext, "instruction">,
): string {
  const lines: string[] = [];
  const confirmed = [
    ...input.canonDecisions,
    ...input.bestPractices,
    ...input.userPreferences,
    ...input.styleRules,
  ];

  if (confirmed.length > 0) {
    lines.push(
      "以下是用户长期确认过的写作偏好、设定决策和正确方案，请优先遵守：",
    );
    lines.push(...confirmed.map(formatInstructionItem));
  }

  if (input.avoidPatterns.length > 0) {
    lines.push("以下是用户明确否定过或验证失败的写法，请避免：");
    lines.push(...input.avoidPatterns.map(formatInstructionItem));
  }

  if (input.workflowRules.length > 0) {
    lines.push(
      "以下是用户确认过的工作流规则，请在工具调用和上下文构建时遵守：",
    );
    lines.push(...input.workflowRules.map(formatInstructionItem));
  }

  if (lines.length === 0) {
    return "暂无已记录的经验记忆；请继续以项目设定、章节上下文和用户当前指令为准。";
  }

  lines.push(
    "如果经验记忆与普通上下文冲突，以 canon facts 和用户明确确认的经验为准。",
  );
  return lines.join("\n");
}

function formatInstructionItem(item: LearningContextItem): string {
  const reason = item.reason ? `；原因：${item.reason}` : "";
  const tags = item.tags.length > 0 ? `；标签：${item.tags.join(", ")}` : "";

  return `- ${item.title}：${item.content}${reason}${tags}`;
}

function compareExperienceRecords(
  left: ExperienceRecord,
  right: ExperienceRecord,
  projectId: string | undefined,
): number {
  const projectDelta =
    projectRank(left, projectId) - projectRank(right, projectId);
  if (projectDelta !== 0) {
    return projectDelta;
  }

  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const confidenceDelta = right.confidence - left.confidence;
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const usageDelta = right.usageCount - left.usageCount;
  if (usageDelta !== 0) {
    return usageDelta;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function projectRank(
  record: ExperienceRecord,
  projectId: string | undefined,
): number {
  if (projectId && record.projectId === projectId) {
    return 0;
  }

  if (record.projectId === null) {
    return projectId ? 1 : 0;
  }

  return projectId ? 2 : 1;
}

function calculateRelevance(
  record: ExperienceRecord,
  terms: readonly string[],
): number {
  if (terms.length === 0) {
    return 0;
  }

  const haystack = normalizeForMatch(
    compactText(
      record.title,
      record.content,
      record.reason ?? null,
      record.tags.join(" "),
    ),
  );

  return terms.reduce((score, term) => {
    const normalizedTerm = normalizeForMatch(term);
    if (!normalizedTerm || !haystack.includes(normalizedTerm)) {
      return score;
    }

    return score + Math.min(normalizedTerm.length, 8);
  }, 0);
}

function extractQueryTerms(query: string): string[] {
  const rawTerms = query
    .split(/[\s,，.。;；:：!！?？、"'“”‘’()[\]{}<>《》]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const normalizedQuery = normalizeForMatch(query);
  const grams =
    normalizedQuery.length >= 4
      ? buildNgrams(normalizedQuery, 2, 4).slice(0, 40)
      : [];

  return Array.from(new Set([...rawTerms, ...grams]));
}

function matchesExperienceDraft(
  record: ExperienceRecord,
  draftContent: string,
): boolean {
  const draft = normalizeForMatch(draftContent);
  if (!draft) {
    return false;
  }

  const terms = extractRecordTerms(record);
  if (
    terms.some((term) => {
      const normalized = normalizeForMatch(term);
      return normalized.length >= 2 && draft.includes(normalized);
    })
  ) {
    return true;
  }

  const recordBody = normalizeForMatch(
    compactText(record.title, record.content, record.reason ?? null),
  );

  return longestCommonSubstringLength(recordBody, draft) >= 4;
}

function conflictsWithCanonDecision(
  record: ExperienceRecord,
  draftContent: string,
): boolean {
  if (!matchesExperienceDraft(record, draftContent)) {
    return false;
  }

  const draft = normalizeForMatch(draftContent);
  const terms = extractRecordTerms(record).map(normalizeForMatch);
  const deniesKnownTerm = terms.some((term) =>
    denialMarkers.some(
      (marker) =>
        term.length >= 2 &&
        (draft.includes(`${marker}${term}`) ||
          draft.includes(`${term}${marker}`)),
    ),
  );

  return (
    deniesKnownTerm || denialMarkers.some((marker) => draft.includes(marker))
  );
}

function extractRecordTerms(record: ExperienceRecord): string[] {
  const chunks = compactText(
    record.title,
    record.content,
    record.reason ?? null,
    record.tags.join(" "),
  )
    .split(/[\s,，.。;；:：!！?？、"'“”‘’()[\]{}<>《》]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 40);
  const stripped = chunks
    .map(stripInstructionWords)
    .filter((term) => term.length >= 2);

  return Array.from(new Set([...record.tags, ...chunks, ...stripped]));
}

function stripInstructionWords(term: string): string {
  return term
    .replace(
      /^(不要|不能|不可|禁止|避免|不允许|请勿|必须|应该|请优先|请遵守)/u,
      "",
    )
    .replace(/(不要|不能|不可|禁止|避免|不允许|请勿)/gu, "")
    .trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s,，.。;；:：!！?？、"'“”‘’()[\]{}<>《》]/gu, "");
}

function buildNgrams(
  value: string,
  minLength: number,
  maxLength: number,
): string[] {
  const grams: string[] = [];
  for (let size = minLength; size <= maxLength; size += 1) {
    for (let index = 0; index + size <= value.length; index += 1) {
      grams.push(value.slice(index, index + size));
    }
  }

  return grams;
}

function longestCommonSubstringLength(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  const previous = new Array<number>(right.length + 1).fill(0);
  const current = new Array<number>(right.length + 1).fill(0);
  let best = 0;

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const leftChar = left[leftIndex - 1];
      const rightChar = right[rightIndex - 1];
      if (leftChar !== undefined && leftChar === rightChar) {
        const nextLength = (previous[rightIndex - 1] ?? 0) + 1;
        current[rightIndex] = nextLength;
        best = Math.max(best, nextLength);
      } else {
        current[rightIndex] = 0;
      }
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex] ?? 0;
      current[rightIndex] = 0;
    }
  }

  return best;
}

function normalizeLimit(
  value: number | undefined,
  defaultValue: number,
  maxValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(1, Math.min(Math.floor(value), maxValue));
}

function normalizeAmount(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
