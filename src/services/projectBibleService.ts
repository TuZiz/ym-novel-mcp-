import type Database from "better-sqlite3";
import type {
  ApplyProjectBibleInput,
  GenerateProjectBiblePromptInput,
  ProjectBible,
  UpdateProjectBibleInput,
} from "../types/novel.js";
import { mapProjectBibleRow } from "../utils/rows.js";
import { nowIso } from "../utils/text.js";
import { ProjectService } from "./projectService.js";

export class ProjectBibleService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
  ) {}

  generateProjectBiblePrompt(input: GenerateProjectBiblePromptInput): string {
    const project = this.projectService.getProject(input.projectId);
    const bible = this.getProjectBible(input.projectId);

    return [
      "请生成长篇小说项目圣经。只输出 JSON，不要解释。",
      "JSON 字段必须包含 premise、logline、coreHook、targetReader、genreFormula、pov、tone、taboo、endingDirection、longTermConflict、chapterWordTarget。",
      "要求：核心钩子必须能支撑长篇连载；类型公式要具体到读者期待、爽点节奏和禁忌；taboo 写明绝不碰的剧情/文风；chapterWordTarget 给出单章目标字数。",
      input.focus ? `本次重点：${input.focus}` : "",
      JSON.stringify({ project, existingBible: bible }, null, 2),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  applyProjectBible(input: ApplyProjectBibleInput): ProjectBible {
    this.projectService.ensureProjectExists(input.projectId);
    const now = nowIso();
    const existing = this.getProjectBible(input.projectId);

    if (existing) {
      return this.updateProjectBible(input);
    }

    this.db
      .prepare(
        `INSERT INTO project_bibles (
          project_id, premise, logline, core_hook, target_reader, genre_formula, pov,
          tone, taboo, ending_direction, long_term_conflict, chapter_word_target,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        input.premise ?? null,
        input.logline ?? null,
        input.coreHook ?? null,
        input.targetReader ?? null,
        input.genreFormula ?? null,
        input.pov ?? null,
        input.tone ?? null,
        input.taboo ?? null,
        input.endingDirection ?? null,
        input.longTermConflict ?? null,
        input.chapterWordTarget ?? null,
        now,
        now,
      );

    if (input.chapterWordTarget) {
      this.projectService.updateProject(input.projectId, {
        chapterWordTarget: input.chapterWordTarget,
      });
    }

    return this.requireProjectBible(input.projectId);
  }

  getProjectBible(projectId: string): ProjectBible | null {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM project_bibles WHERE project_id = ?")
      .get(projectId) as Record<string, unknown> | undefined;

    return row ? mapProjectBibleRow(row) : null;
  }

  updateProjectBible(input: UpdateProjectBibleInput): ProjectBible {
    const current = this.requireProjectBible(input.projectId);
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE project_bibles
        SET premise = ?, logline = ?, core_hook = ?, target_reader = ?, genre_formula = ?,
            pov = ?, tone = ?, taboo = ?, ending_direction = ?, long_term_conflict = ?,
            chapter_word_target = ?, updated_at = ?
        WHERE project_id = ?`,
      )
      .run(
        input.premise ?? current.premise,
        input.logline ?? current.logline,
        input.coreHook ?? current.coreHook,
        input.targetReader ?? current.targetReader,
        input.genreFormula ?? current.genreFormula,
        input.pov ?? current.pov,
        input.tone ?? current.tone,
        input.taboo ?? current.taboo,
        input.endingDirection ?? current.endingDirection,
        input.longTermConflict ?? current.longTermConflict,
        input.chapterWordTarget ?? current.chapterWordTarget,
        updatedAt,
        input.projectId,
      );

    if (input.chapterWordTarget) {
      this.projectService.updateProject(input.projectId, {
        chapterWordTarget: input.chapterWordTarget,
      });
    }

    return this.requireProjectBible(input.projectId);
  }

  private requireProjectBible(projectId: string): ProjectBible {
    const bible = this.getProjectBible(projectId);
    if (!bible) {
      throw new Error(`Project bible for ${projectId} not found.`);
    }
    return bible;
  }
}
