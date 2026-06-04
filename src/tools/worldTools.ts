import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerWorldTools(server: McpServer, services: AppServices): void {
  server.registerTool(
    "add_world_item",
    {
      description: "添加世界观设定。",
      inputSchema: {
        projectId: z.string().min(1),
        type: z.string().min(1),
        name: z.string().min(1),
        content: z.string().min(1),
        importance: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string()).optional()
      }
    },
    wrapToolHandler((args) => services.worldService.addWorldItem(args))
  );

  server.registerTool(
    "search_world_items",
    {
      description: "搜索世界观设定。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        type: z.string().optional(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, type, limit }) =>
      services.worldService.searchWorldItems(projectId, query, type, limit)
    )
  );

  server.registerTool(
    "get_world_context",
    {
      description: "获取某一写作焦点下的世界观上下文。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, limit }) =>
      services.worldService.getWorldContext(projectId, query, limit)
    )
  );
}
