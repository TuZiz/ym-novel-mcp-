import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

const experienceScopes = [
  "global",
  "project",
  "character",
  "world",
  "chapter",
  "style",
  "workflow",
] as const;

const experienceTypes = [
  "best_practice",
  "avoid_pattern",
  "user_preference",
  "correction",
  "successful_solution",
  "failed_solution",
  "style_rule",
  "workflow_rule",
  "canon_decision",
] as const;

const feedbackActions = [
  "accepted",
  "rejected",
  "corrected",
  "improved",
  "bad_result",
  "good_result",
] as const;

const workflowResults = [
  "success",
  "partial",
  "failed",
  "user_rejected",
  "user_accepted",
] as const;

export function registerLearningMemoryTools(
  server: McpServer,
  services: AppServices,
): void {
  server.registerTool(
    "record_experience",
    {
      description: "记录用户确认过的正确方案、错误方案、写作偏好或设定决策。",
      inputSchema: {
        projectId: z.string().optional(),
        scope: z.enum(experienceScopes),
        type: z.enum(experienceTypes),
        title: z.string().min(1),
        content: z.string().min(1),
        reason: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sourceType: z.string().optional(),
        sourceId: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.recordExperience(args),
    ),
  );

  server.registerTool(
    "search_experiences",
    {
      description: "搜索经验记忆库，项目级经验优先于全局经验。",
      inputSchema: {
        projectId: z.string().optional(),
        query: z.string().min(1),
        scope: z.enum(experienceScopes).optional(),
        type: z.enum(experienceTypes).optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().int().positive().max(50).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.searchExperiences(args),
    ),
  );

  server.registerTool(
    "record_feedback",
    {
      description: "记录用户对工具结果或 AI 输出的反馈。",
      inputSchema: {
        projectId: z.string().optional(),
        targetType: z.string().min(1),
        targetId: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        feedback: z.string().min(1),
        action: z.enum(feedbackActions).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.recordFeedback(args),
    ),
  );

  server.registerTool(
    "promote_experience",
    {
      description: "提高一条经验的权重与可信度。",
      inputSchema: {
        experienceId: z.string().min(1),
        amount: z.number().int().positive().max(100).optional(),
        reason: z.string().optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.promoteExperience(args),
    ),
  );

  server.registerTool(
    "suppress_experience",
    {
      description: "降低一条经验的权重，必要时标记为 inactive，但不删除。",
      inputSchema: {
        experienceId: z.string().min(1),
        amount: z.number().int().positive().max(100).optional(),
        reason: z.string().optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.suppressExperience(args),
    ),
  );

  server.registerTool(
    "get_learning_context",
    {
      description: "获取当前写作或检查时应该注入的经验上下文。",
      inputSchema: {
        projectId: z.string().optional(),
        query: z.string().optional(),
        chapterIndex: z.number().int().positive().optional(),
        focus: z.string().optional(),
        limit: z.number().int().positive().max(20).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.getLearningContext(args),
    ),
  );

  server.registerTool(
    "record_workflow_run",
    {
      description: "记录一次关键工作流的执行结果。",
      inputSchema: {
        projectId: z.string().min(1),
        workflowType: z.string().min(1),
        inputSummary: z.string().optional(),
        outputSummary: z.string().optional(),
        result: z.enum(workflowResults),
        notes: z.string().optional(),
      },
    },
    wrapToolHandler((args) =>
      services.learningMemoryService.recordWorkflowRun(args),
    ),
  );
}
