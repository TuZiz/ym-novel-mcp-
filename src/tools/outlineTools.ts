import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerOutlineTools(server: McpServer, services: AppServices): void {
  server.registerTool(
    "create_volume",
    {
      description: "创建卷。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeIndex: z.number().int().positive(),
        title: z.string().min(1),
        goal: z.string().optional(),
        conflict: z.string().optional(),
        startChapter: z.number().int().positive().optional(),
        endChapter: z.number().int().positive().optional(),
        summary: z.string().optional(),
        status: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.outlineService.createVolume(args))
  );

  server.registerTool(
    "get_current_volume",
    {
      description: "获取当前卷。",
      inputSchema: {
        projectId: z.string().min(1)
      }
    },
    wrapToolHandler(({ projectId }) => services.outlineService.getCurrentVolume(projectId))
  );

  server.registerTool(
    "update_volume",
    {
      description: "更新卷信息。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeId: z.string().min(1),
        title: z.string().optional(),
        goal: z.string().nullable().optional(),
        conflict: z.string().nullable().optional(),
        startChapter: z.number().int().positive().nullable().optional(),
        endChapter: z.number().int().positive().nullable().optional(),
        summary: z.string().nullable().optional(),
        status: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.outlineService.updateVolume(args))
  );

  server.registerTool(
    "create_chapter_outline",
    {
      description: "创建章节大纲。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeId: z.string().optional(),
        chapterIndex: z.number().int().positive(),
        title: z.string().min(1),
        goal: z.string().optional(),
        conflict: z.string().optional(),
        keyEvents: z.string().optional(),
        requiredCharacters: z.array(z.string()).optional(),
        requiredForeshadowing: z.array(z.string()).optional(),
        endingHook: z.string().optional(),
        status: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.outlineService.createChapterOutline(args))
  );

  server.registerTool(
    "get_chapter_outline",
    {
      description: "获取章节大纲。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive()
      }
    },
    wrapToolHandler(({ projectId, chapterIndex }) =>
      services.outlineService.getChapterOutline(projectId, chapterIndex)
    )
  );

  server.registerTool(
    "list_chapter_outlines",
    {
      description: "列出章节大纲。",
      inputSchema: {
        projectId: z.string().min(1),
        volumeId: z.string().optional()
      }
    },
    wrapToolHandler(({ projectId, volumeId }) =>
      services.outlineService.listChapterOutlines(projectId, volumeId)
    )
  );

  server.registerTool(
    "update_chapter_outline",
    {
      description: "更新章节大纲。",
      inputSchema: {
        projectId: z.string().min(1),
        outlineId: z.string().min(1),
        chapterIndex: z.number().int().positive().optional(),
        title: z.string().optional(),
        goal: z.string().nullable().optional(),
        conflict: z.string().nullable().optional(),
        keyEvents: z.string().nullable().optional(),
        requiredCharacters: z.array(z.string()).optional(),
        requiredForeshadowing: z.array(z.string()).optional(),
        endingHook: z.string().nullable().optional(),
        status: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.outlineService.updateChapterOutline(args))
  );
}
