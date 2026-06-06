import { afterEach, describe, expect, it } from "vitest";
import type {
  ExperienceRecord,
  FeedbackEvent,
  LearningContext,
  Project,
  SearchExperiencesResult,
  WorkflowRun,
} from "../src/types/novel.js";
import {
  callToolData,
  createMcpTestHarness,
  type McpTestHarness,
} from "./helpers.js";

const harnesses: McpTestHarness[] = [];

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    await harness?.close();
  }
});

describe("learning memory MCP tools", () => {
  it("registers and calls all learning memory tools through MCP", async () => {
    const { client } = await trackHarness();
    const toolList = await client.listTools();

    expect(toolList.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "record_experience",
        "search_experiences",
        "record_feedback",
        "promote_experience",
        "suppress_experience",
        "get_learning_context",
        "record_workflow_run",
      ]),
    );

    const project = await callToolData<Project>(client, "create_project", {
      name: "经验记忆 MCP",
    });
    const experience = await callToolData<ExperienceRecord>(
      client,
      "record_experience",
      {
        projectId: project.id,
        scope: "style",
        type: "avoid_pattern",
        title: "不要让主角突然圣母",
        content: "主角不能无理由放过反复害他的敌人。",
        reason: "用户明确否定过这种写法。",
        tags: ["主角", "爽文"],
        confidence: 0.86,
      },
    );
    const search = await callToolData<SearchExperiencesResult>(
      client,
      "search_experiences",
      {
        projectId: project.id,
        query: "圣母",
        limit: 5,
      },
    );
    const promoted = await callToolData<ExperienceRecord>(
      client,
      "promote_experience",
      {
        experienceId: experience.id,
        amount: 2,
        reason: "测试确认有效",
      },
    );
    const feedback = await callToolData<FeedbackEvent>(
      client,
      "record_feedback",
      {
        projectId: project.id,
        targetType: "experience",
        targetId: experience.id,
        rating: 5,
        feedback: "这条经验继续采用。",
        action: "good_result",
      },
    );
    const suppressed = await callToolData<ExperienceRecord>(
      client,
      "suppress_experience",
      {
        experienceId: experience.id,
        amount: 1,
        reason: "权重微调",
      },
    );
    const learningContext = await callToolData<LearningContext>(
      client,
      "get_learning_context",
      {
        projectId: project.id,
        query: "圣母 主角",
        limit: 5,
      },
    );
    const workflowRun = await callToolData<WorkflowRun>(
      client,
      "record_workflow_run",
      {
        projectId: project.id,
        workflowType: "continuity_check",
        inputSummary: "草稿检查",
        outputSummary: "发现学习规则风险",
        result: "partial",
        notes: "MCP 测试",
      },
    );

    expect(experience.status).toBe("active");
    expect(search.results.map((item) => item.id)).toContain(experience.id);
    expect(promoted.score).toBe(2);
    expect(feedback.action).toBe("good_result");
    expect(suppressed.score).toBe(2);
    expect(suppressed.status).toBe("active");
    expect(learningContext.avoidPatterns.map((item) => item.id)).toContain(
      experience.id,
    );
    expect(learningContext.instruction).toContain("请避免");
    expect(workflowRun.workflowType).toBe("continuity_check");
    expect(workflowRun.result).toBe("partial");
  });
});

async function trackHarness(): Promise<McpTestHarness> {
  const harness = await createMcpTestHarness();
  harnesses.push(harness);
  return harness;
}
