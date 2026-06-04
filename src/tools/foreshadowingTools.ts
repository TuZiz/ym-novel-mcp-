import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerForeshadowingTools(
  server: McpServer,
  services: AppServices
): void {
  server.registerTool(
    "add_foreshadowing",
    {
      description: "添加伏笔。",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        introducedChapterId: z.string().optional(),
        expectedResolveChapter: z.number().int().positive().optional(),
        importance: z.number().int().min(1).max(5).optional(),
        relatedCharacters: z.array(z.string()).optional(),
        relatedWorldItems: z.array(z.string()).optional(),
        notes: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.foreshadowingService.addForeshadowing(args))
  );

  server.registerTool(
    "list_open_foreshadowings",
    {
      description: "列出未回收伏笔。",
      inputSchema: {
        projectId: z.string().min(1),
        limit: z.number().int().positive().max(100).optional()
      }
    },
    wrapToolHandler(({ projectId, limit }) =>
      services.foreshadowingService.listOpenForeshadowings(projectId, limit)
    )
  );

  server.registerTool(
    "resolve_foreshadowing",
    {
      description: "回收伏笔。",
      inputSchema: {
        projectId: z.string().min(1),
        foreshadowingId: z.string().min(1),
        resolvedChapterId: z.string().optional(),
        status: z.enum(["partially_resolved", "resolved", "abandoned"]).optional(),
        notes: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.foreshadowingService.resolveForeshadowing(args))
  );

  server.registerTool(
    "search_foreshadowings",
    {
      description: "搜索伏笔。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, limit }) =>
      services.foreshadowingService.searchForeshadowings(projectId, query, limit)
    )
  );
}
