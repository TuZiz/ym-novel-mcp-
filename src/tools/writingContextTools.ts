import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

const postChapterUpdateSchema = z.object({
  summary: z.string().optional(),
  hook: z.string().optional(),
  characterUpdates: z
    .array(
      z.object({
        characterId: z.string().optional(),
        name: z.string().optional(),
        currentState: z.string().optional(),
        powerLevel: z.string().optional(),
        location: z.string().optional(),
        status: z.string().optional(),
        relationshipSummary: z.string().optional(),
        lastAppearanceChapter: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  newWorldItems: z
    .array(
      z.object({
        type: z.string().min(1),
        name: z.string().min(1),
        content: z.string().min(1),
        importance: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  newForeshadowings: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        expectedResolveChapter: z.number().int().positive().optional(),
        importance: z.number().int().min(1).max(5).optional(),
        relatedCharacters: z.array(z.string()).optional(),
        relatedWorldItems: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  resolvedForeshadowings: z
    .array(
      z.object({
        foreshadowingId: z.string().min(1),
        resolvedChapterId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  timelineEvents: z
    .array(
      z.object({
        eventOrder: z.number().int().nonnegative().optional(),
        title: z.string().min(1),
        description: z.string().min(1),
        involvedCharacters: z.array(z.string()).optional(),
        location: z.string().optional(),
        impact: z.string().optional(),
      }),
    )
    .optional(),
  canonFacts: z
    .array(
      z.object({
        sourceType: z.string().optional(),
        factType: z.string().min(1),
        content: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
        importance: z.number().int().min(1).max(5).optional(),
      }),
    )
    .optional(),
});

export function registerWritingContextTools(
  server: McpServer,
  services: AppServices,
): void {
  server.registerTool(
    "build_next_chapter_context",
    {
      description: "构建下一章写作上下文。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive(),
        volumeId: z.string().optional(),
        focus: z.string().optional(),
        recentChapterLimit: z.number().int().positive().max(20).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.writingContextService.buildNextChapterContext(args),
    ),
  );

  server.registerTool(
    "plan_next_chapter",
    {
      description: "根据现有资料生成下一章大纲建议和写作指令。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive(),
        volumeId: z.string().optional(),
        focus: z.string().optional(),
      },
    },
    wrapToolHandler((args) =>
      services.chapterPipelineService.planNextChapter(args),
    ),
  );

  server.registerTool(
    "build_post_chapter_update_prompt",
    {
      description: "生成章节写完后的资料整理提示词和 JSON Schema。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive(),
      },
    },
    wrapToolHandler((args) =>
      services.chapterPipelineService.buildPostChapterUpdatePrompt(args),
    ),
  );

  server.registerTool(
    "apply_post_chapter_update",
    {
      description: "把章节写完后的结构化整理结果写回数据库。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive(),
        update: postChapterUpdateSchema,
      },
    },
    wrapToolHandler((args) =>
      services.chapterPipelineService.applyPostChapterUpdate(args),
    ),
  );
}
