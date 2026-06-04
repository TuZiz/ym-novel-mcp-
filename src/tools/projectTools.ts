import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerProjectTools(server: McpServer, services: AppServices): void {
  server.registerTool(
    "create_project",
    {
      description: "创建小说项目。",
      inputSchema: {
        name: z.string().min(1),
        genre: z.string().optional(),
        platform: z.string().optional(),
        targetWords: z.number().int().positive().optional(),
        style: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.projectService.createProject(args))
  );

  server.registerTool(
    "get_project",
    {
      description: "获取项目详情。",
      inputSchema: {
        projectId: z.string().min(1)
      }
    },
    wrapToolHandler(({ projectId }) => services.projectService.getProject(projectId))
  );

  server.registerTool(
    "list_projects",
    {
      description: "列出所有项目。"
    },
    wrapToolHandler(() => services.projectService.listProjects())
  );

  server.registerTool(
    "update_project",
    {
      description: "更新项目信息。",
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().optional(),
        genre: z.string().nullable().optional(),
        platform: z.string().nullable().optional(),
        targetWords: z.number().int().positive().nullable().optional(),
        currentWords: z.number().int().nonnegative().optional(),
        style: z.string().nullable().optional(),
        status: z.string().optional()
      }
    },
    wrapToolHandler(({ projectId, ...patch }) =>
      services.projectService.updateProject(projectId, patch)
    )
  );
}
