import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerWritingContextTools(
  server: McpServer,
  services: AppServices
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
        recentChapterLimit: z.number().int().positive().max(20).optional()
      }
    },
    wrapToolHandler((args) => services.writingContextService.buildNextChapterContext(args))
  );

  server.registerTool(
    "plan_next_chapter",
    {
      description: "根据现有资料生成下一章大纲建议和写作指令。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive(),
        volumeId: z.string().optional(),
        focus: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.chapterPipelineService.planNextChapter(args))
  );

  server.registerTool(
    "build_post_chapter_update_prompt",
    {
      description: "生成章节写完后的资料整理提示词和 JSON Schema。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive()
      }
    },
    wrapToolHandler((args) =>
      services.chapterPipelineService.buildPostChapterUpdatePrompt(args)
    )
  );
}
