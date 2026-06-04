import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerTimelineTools(server: McpServer, services: AppServices): void {
  server.registerTool(
    "add_timeline_event",
    {
      description: "添加时间线事件。",
      inputSchema: {
        projectId: z.string().min(1),
        chapterId: z.string().optional(),
        eventOrder: z.number().int().nonnegative(),
        title: z.string().min(1),
        description: z.string().min(1),
        involvedCharacters: z.array(z.string()).optional(),
        location: z.string().optional(),
        impact: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.timelineService.addTimelineEvent(args))
  );

  server.registerTool(
    "get_timeline",
    {
      description: "获取时间线。",
      inputSchema: {
        projectId: z.string().min(1)
      }
    },
    wrapToolHandler(({ projectId }) => services.timelineService.getTimeline(projectId))
  );

  server.registerTool(
    "search_timeline",
    {
      description: "搜索时间线。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, limit }) =>
      services.timelineService.searchTimeline(projectId, query, limit)
    )
  );
}
