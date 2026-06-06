import { afterEach, describe, expect, it } from "vitest";
import type {
  ContinuityCheckResult,
  ExperienceRecord,
  FeedbackEvent,
  LearningContext,
  NextChapterContext,
  WorkflowRun,
} from "../src/types/novel.js";
import type { AppInstance } from "../src/server.js";
import { createTestApp } from "./helpers.js";

const apps: AppInstance[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    await app?.close();
  }
});

describe("learning memory service", () => {
  it("records, searches, promotes, suppresses, and adjusts experience feedback", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "经验记忆",
    });
    const globalExperience =
      app.services.learningMemoryService.recordExperience({
        scope: "style",
        type: "avoid_pattern",
        title: "不要让主角突然圣母",
        content: "主角不能无理由放过反复害他的敌人。",
        tags: ["主角", "爽文"],
      });
    const projectExperience =
      app.services.learningMemoryService.recordExperience({
        projectId: project.id,
        scope: "style",
        type: "avoid_pattern",
        title: "本项目不要圣母式放过敌人",
        content: "关键利益冲突里，主角不能无代价放走持续作恶的敌人。",
        reason: "用户明确否定过这种写法。",
        tags: ["主角", "敌人"],
        confidence: 0.9,
      });

    const search = app.services.learningMemoryService.searchExperiences({
      projectId: project.id,
      query: "圣母",
      limit: 10,
    });
    const promoted = app.services.learningMemoryService.promoteExperience({
      experienceId: projectExperience.id,
      amount: 2,
      reason: "多次有效",
    });
    const feedback = app.services.learningMemoryService.recordFeedback({
      projectId: project.id,
      targetType: "experience",
      targetId: projectExperience.id,
      feedback: "这条规则继续有效。",
      action: "accepted",
      rating: 5,
    });
    const afterFeedback = app.services.learningMemoryService.getExperience(
      projectExperience.id,
    );
    const suppressed = app.services.learningMemoryService.suppressExperience({
      experienceId: projectExperience.id,
      amount: 8,
      reason: "当前项目后续不再适用",
    });
    const afterSuppressSearch =
      app.services.learningMemoryService.searchExperiences({
        projectId: project.id,
        query: "圣母",
        limit: 10,
      });

    expectExperience(projectExperience);
    expect(search.results[0]?.id).toBe(projectExperience.id);
    expect(search.results.map((item) => item.id)).toContain(
      globalExperience.id,
    );
    expect(promoted.score).toBe(2);
    expect(promoted.confidence).toBeGreaterThan(0.9);
    expectFeedback(feedback);
    expect(afterFeedback.score).toBe(3);
    expect(suppressed.score).toBe(-5);
    expect(suppressed.status).toBe("inactive");
    expect(afterSuppressSearch.results.map((item) => item.id)).not.toContain(
      projectExperience.id,
    );
    expect(afterSuppressSearch.results.map((item) => item.id)).toContain(
      globalExperience.id,
    );
  });

  it("builds learning context and records workflow runs", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "学习上下文",
    });
    const bestPractice = app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "project",
      type: "best_practice",
      title: "风铃线索要逐章加压",
      content: "风铃相关线索每次出现都要带来新的风险或选择。",
      tags: ["风铃"],
    });
    app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "style",
      type: "user_preference",
      title: "偏好快节奏冲突",
      content: "章节中段要有直接行动，不要只写心理活动。",
      tags: ["节奏"],
    });
    app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "workflow",
      type: "workflow_rule",
      title: "写作前先构建上下文",
      content: "写下一章前先调用 build_next_chapter_context。",
    });
    app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "world",
      type: "canon_decision",
      title: "风铃只能由顾昭唤醒",
      content: "禁地风铃只能由顾昭以旧名唤醒。",
      tags: ["风铃", "顾昭"],
    });

    const context = app.services.learningMemoryService.getLearningContext({
      projectId: project.id,
      query: "风铃 顾昭",
      chapterIndex: 3,
      focus: "禁地风铃",
      limit: 5,
    });
    const workflowRun = app.services.learningMemoryService.recordWorkflowRun({
      projectId: project.id,
      workflowType: "next_chapter_context",
      inputSummary: "第 3 章",
      outputSummary: "已注入学习上下文",
      result: "success",
    });
    const usedExperience = app.services.learningMemoryService.getExperience(
      bestPractice.id,
    );

    expectLearningContext(context);
    expect(context.bestPractices.map((item) => item.id)).toContain(
      bestPractice.id,
    );
    expect(context.canonDecisions[0]?.title).toContain("风铃");
    expect(context.workflowRules[0]?.title).toContain("构建上下文");
    expect(usedExperience.usageCount).toBe(1);
    expectWorkflowRun(workflowRun);
  });

  it("injects learning context and detects learned avoid patterns", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "连续性经验",
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "旧怨",
      content: "顾昭被敌人背刺，决定下一章清算。",
      summary: "敌人背刺顾昭。",
      hook: "顾昭看见敌人再次举刀。",
    });
    app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "style",
      type: "avoid_pattern",
      title: "不要让主角突然圣母",
      content: "主角不能无理由放过反复害他的敌人。",
      reason: "会削弱爽感。",
      tags: ["主角", "敌人"],
    });
    app.services.learningMemoryService.recordExperience({
      projectId: project.id,
      scope: "world",
      type: "canon_decision",
      title: "敌人已经反复害过顾昭",
      content: "这名敌人已经三次主动害过顾昭。",
      tags: ["敌人", "顾昭"],
    });

    const context =
      app.services.writingContextService.buildNextChapterContext({
        projectId: project.id,
        chapterIndex: 2,
        focus: "敌人清算",
      });
    const continuity = app.services.continuityService.checkContinuity({
      projectId: project.id,
      chapterIndex: 2,
      draftContent:
        "顾昭在关键战斗中无理由放过敌人，还说这名敌人并没有三次主动害过顾昭。",
    });
    app.services.chapterPipelineService.applyPostChapterUpdate({
      projectId: project.id,
      chapterIndex: 1,
      update: {
        summary: "顾昭确认敌人背刺。",
      },
    });
    const workflowCount = app.database.db
      .prepare(
        "SELECT COUNT(*) AS count FROM workflow_runs WHERE project_id = ? AND workflow_type = 'post_chapter_update'",
      )
      .get(project.id) as { count: number };

    expectNextChapterContext(context);
    expect(context.learningContext.avoidPatterns[0]?.title).toContain("圣母");
    expect(context.instruction).toContain("learningContext");
    expectContinuity(continuity);
    expect(continuity.warnings.map((warning) => warning.type)).toEqual(
      expect.arrayContaining([
        "learned_avoid_pattern_risk",
        "learned_canon_decision_conflict",
      ]),
    );
    expect(workflowCount.count).toBe(1);
  });
});

function createTrackedApp(): AppInstance {
  const app = createTestApp();
  apps.push(app);
  return app;
}

function expectExperience(experience: ExperienceRecord): void {
  expect(experience.id).toContain("exp_");
  expect(experience.status).toBe("active");
  expect(experience.score).toBe(0);
  expect(experience.usageCount).toBe(0);
}

function expectFeedback(feedback: FeedbackEvent): void {
  expect(feedback.id).toContain("feedback_");
  expect(feedback.action).toBe("accepted");
  expect(feedback.rating).toBe(5);
}

function expectLearningContext(context: LearningContext): void {
  expect(context.bestPractices.length).toBeGreaterThan(0);
  expect(context.userPreferences.length).toBeGreaterThan(0);
  expect(context.instruction).toContain("用户长期确认过");
}

function expectWorkflowRun(workflowRun: WorkflowRun): void {
  expect(workflowRun.id).toContain("workflow_");
  expect(workflowRun.workflowType).toBe("next_chapter_context");
  expect(workflowRun.result).toBe("success");
}

function expectNextChapterContext(context: NextChapterContext): void {
  expect(context.learningContext.instruction).toContain("明确否定");
  expect(context.searchHints).toContain("敌人清算");
}

function expectContinuity(result: ContinuityCheckResult): void {
  expect(result.ok).toBe(false);
  expect(result.warnings.length).toBeGreaterThan(0);
}
