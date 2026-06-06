import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerProjectTools(
  server: McpServer,
  services: AppServices,
): void {
  const log = (toolName: string) => ({ services, toolName });

  server.registerTool(
    "create_project",
    {
      description: "创建小说项目。",
      inputSchema: {
        name: z.string().min(1),
        genre: z.string().optional(),
        platform: z.string().optional(),
        targetWords: z.number().int().positive().optional(),
        chapterWordTarget: z.number().int().positive().optional(),
        minChapterWords: z.number().int().positive().optional(),
        maxChapterWords: z.number().int().positive().optional(),
        style: z.string().optional(),
      },
    },
    wrapToolHandler(
      (args) => services.projectService.createProject(args),
      log("create_project"),
    ),
  );

  server.registerTool(
    "get_project",
    {
      description: "获取项目详情。",
      inputSchema: {
        projectId: z.string().min(1),
      },
    },
    wrapToolHandler(({ projectId }) =>
      services.projectService.getProject(projectId),
    ),
  );

  server.registerTool(
    "list_projects",
    {
      description: "列出所有项目。",
    },
    wrapToolHandler(() => services.projectService.listProjects()),
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
        chapterWordTarget: z.number().int().positive().nullable().optional(),
        minChapterWords: z.number().int().positive().nullable().optional(),
        maxChapterWords: z.number().int().positive().nullable().optional(),
        currentWords: z.number().int().nonnegative().optional(),
        style: z.string().nullable().optional(),
        status: z.string().optional(),
      },
    },
    wrapToolHandler(({ projectId, ...patch }) =>
      services.projectService.updateProject(projectId, patch),
    ),
  );

  server.registerTool(
    "export_project",
    {
      description: "导出整个小说项目为结构化 JSON。",
      inputSchema: {
        projectId: z.string().min(1),
      },
    },
    wrapToolHandler(({ projectId }) =>
      services.projectTransferService.exportProject(projectId),
    ),
  );

  const projectBibleInputSchema = {
    projectId: z.string().min(1),
    premise: z.string().optional(),
    logline: z.string().optional(),
    coreHook: z.string().optional(),
    targetReader: z.string().optional(),
    genreFormula: z.string().optional(),
    pov: z.string().optional(),
    tone: z.string().optional(),
    taboo: z.string().optional(),
    endingDirection: z.string().optional(),
    longTermConflict: z.string().optional(),
    chapterWordTarget: z.number().int().positive().optional(),
  };

  server.registerTool(
    "generate_project_bible_prompt",
    {
      description: "生成项目圣经写作提示词。",
      inputSchema: {
        projectId: z.string().min(1),
        focus: z.string().optional(),
      },
    },
    wrapToolHandler(
      (args) => services.projectBibleService.generateProjectBiblePrompt(args),
      log("generate_project_bible_prompt"),
    ),
  );

  server.registerTool(
    "apply_project_bible",
    {
      description: "写入项目圣经。",
      inputSchema: projectBibleInputSchema,
    },
    wrapToolHandler(
      (args) => services.projectBibleService.applyProjectBible(args),
      log("apply_project_bible"),
    ),
  );

  server.registerTool(
    "get_project_bible",
    {
      description: "读取项目圣经。",
      inputSchema: {
        projectId: z.string().min(1),
      },
    },
    wrapToolHandler(({ projectId }) =>
      services.projectBibleService.getProjectBible(projectId),
    ),
  );

  server.registerTool(
    "update_project_bible",
    {
      description: "更新项目圣经。",
      inputSchema: projectBibleInputSchema,
    },
    wrapToolHandler(
      (args) => services.projectBibleService.updateProjectBible(args),
      log("update_project_bible"),
    ),
  );

  server.registerTool(
    "export_workspace_files",
    {
      description: "导出 Markdown/JSON 工程目录。",
      inputSchema: {
        projectId: z.string().min(1),
        outputDir: z.string().optional(),
      },
    },
    wrapToolHandler(
      (args) => services.workspaceExportService.exportWorkspaceFiles(args),
      log("export_workspace_files"),
    ),
  );

  server.registerTool(
    "import_project",
    {
      description: "从结构化 JSON 导入小说项目。",
      inputSchema: {
        data: z.record(z.string(), z.unknown()),
        mode: z.enum(["new_project", "overwrite"]).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.projectTransferService.importProject(args),
    ),
  );

  server.registerTool(
    "create_project_snapshot",
    {
      description: "创建项目结构化快照，用于长篇小说阶段性回滚准备。",
      inputSchema: {
        projectId: z.string().min(1),
        label: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    wrapToolHandler((args) => {
      const snapshot = services.projectSnapshotService.createSnapshot(args);
      return {
        snapshotId: snapshot.id,
        projectId: snapshot.projectId,
        label: snapshot.label ?? undefined,
        notes: snapshot.notes ?? undefined,
        createdAt: snapshot.createdAt,
      };
    }, log("create_project_snapshot")),
  );

  server.registerTool(
    "list_project_snapshots",
    {
      description: "列出指定项目的快照。",
      inputSchema: {
        projectId: z.string().min(1),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    wrapToolHandler((args) =>
      services.projectSnapshotService.listSnapshots(args),
    ),
  );

  server.registerTool(
    "get_project_snapshot",
    {
      description: "获取项目快照详情和快照内容。",
      inputSchema: {
        snapshotId: z.string().min(1),
      },
    },
    wrapToolHandler(({ snapshotId }) =>
      services.projectSnapshotService.getSnapshot(snapshotId),
    ),
  );
}
