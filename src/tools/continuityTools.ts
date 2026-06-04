import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerContinuityTools(
  server: McpServer,
  services: AppServices
): void {
  server.registerTool(
    "check_continuity",
    {
      description: "检查新章节草稿是否可能违反既有设定。",
      inputSchema: {
        projectId: z.string().min(1),
        draftContent: z.string().min(1),
        relatedCharacterIds: z.array(z.string()).optional(),
        relatedWorldItemIds: z.array(z.string()).optional(),
        chapterIndex: z.number().int().positive().optional()
      }
    },
    wrapToolHandler((args) => services.continuityService.checkContinuity(args))
  );
}
