import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { AppError } from "../utils/errors.js";
import { wrapToolHandler } from "./toolUtils.js";

const getChapterSchema = z
  .object({
    projectId: z.string().min(1),
    chapterId: z.string().optional(),
    chapterIndex: z.number().int().positive().optional()
  })
  .refine((value) => Boolean(value.chapterId || value.chapterIndex), {
    message: "chapterId or chapterIndex is required",
    path: ["chapterId"]
  });

export function registerChapterTools(server: McpServer, services: AppServices): void {
  const log = (toolName: string) => ({ services, toolName });

  server.registerTool(
    "save_chapter",
    {
      description: "保存章节正文。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeId: z.string().optional(),
        chapterIndex: z.number().int().positive(),
        title: z.string().min(1),
        content: z.string().min(1),
        summary: z.string().optional(),
        hook: z.string().optional(),
        involvedCharacters: z.array(z.string()).optional(),
        involvedWorldItems: z.array(z.string()).optional(),
        status: z.string().optional(),
        allowShortReason: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.chapterService.saveChapter(args), log("save_chapter"))
  );

  server.registerTool(
    "save_chapter_with_quality_gate",
    {
      description: "保存章节，并启用章节质量门禁。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeId: z.string().optional(),
        chapterIndex: z.number().int().positive(),
        title: z.string().min(1),
        content: z.string().min(1),
        summary: z.string().optional(),
        hook: z.string().optional(),
        involvedCharacters: z.array(z.string()).optional(),
        involvedWorldItems: z.array(z.string()).optional(),
        status: z.string().optional(),
        allowShortReason: z.string().optional()
      }
    },
    wrapToolHandler(
      (args) => services.chapterService.saveChapter(args),
      log("save_chapter_with_quality_gate"),
    )
  );

  server.registerTool(
    "review_chapter_quality",
    {
      description: "检查章节字数、场景数、冲突推进、结尾钩子、AI味表达和总结化比例。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive().optional(),
        title: z.string().optional(),
        content: z.string().min(1),
        hook: z.string().optional()
      }
    },
    wrapToolHandler(
      (args) => services.chapterService.reviewChapterQuality(args),
      log("review_chapter_quality"),
    )
  );

  server.registerTool(
    "expand_chapter_prompt",
    {
      description: "当章节过短时，生成扩写提示词。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive().optional(),
        title: z.string().optional(),
        content: z.string().min(1),
        currentIssues: z.array(z.string()).optional()
      }
    },
    wrapToolHandler(
      (args) => services.chapterService.expandChapterPrompt(args),
      log("expand_chapter_prompt"),
    )
  );

  server.registerTool(
    "get_chapter",
    {
      description: "获取章节。",
      inputSchema: getChapterSchema
    },
    wrapToolHandler(({ projectId, chapterId, chapterIndex }) => {
      if (chapterId) {
        return services.chapterService.getChapter(projectId, chapterId);
      }

      const chapter = services.chapterService.getChapterByIndex(
        projectId,
        chapterIndex as number
      );
      if (!chapter) {
        throw new AppError(`Chapter ${chapterIndex} not found.`, "NOT_FOUND");
      }
      return chapter;
    })
  );

  server.registerTool(
    "get_recent_chapters",
    {
      description: "获取最近 N 章。",
      inputSchema: {
        projectId: z.string().min(1),
        beforeChapterIndex: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeContent: z.boolean().optional()
      }
    },
    wrapToolHandler((args) => services.chapterService.getRecentChapters(args))
  );

  server.registerTool(
    "search_chapters",
    {
      description: "全文搜索章节。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, limit }) =>
      services.chapterService.searchChapters(projectId, query, limit)
    )
  );

  server.registerTool(
    "update_chapter_summary",
    {
      description: "更新章节摘要。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterId: z.string().min(1),
        summary: z.string().min(1)
      }
    },
    wrapToolHandler(
      (args) => services.chapterService.updateChapterSummary(args),
      log("update_chapter_summary"),
    )
  );
}
