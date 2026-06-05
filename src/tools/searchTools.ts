import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

const searchAllIncludeSchema = z.enum([
  "chapters",
  "characters",
  "world_items",
  "foreshadowings",
  "timeline",
  "canon_facts",
]);

export function registerSearchTools(
  server: McpServer,
  services: AppServices,
): void {
  server.registerTool(
    "search_all",
    {
      description:
        "跨章节、人物、世界观、伏笔、时间线和 canon facts 统一搜索。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(100).optional(),
        include: z.array(searchAllIncludeSchema).optional(),
      },
    },
    wrapToolHandler((args) => services.searchService.searchAll(args)),
  );
}
