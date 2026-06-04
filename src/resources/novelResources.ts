import {
  McpServer,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppServices } from "../types/app.js";

export function registerNovelResources(
  server: McpServer,
  services: AppServices
): void {
  server.registerResource(
    "projects",
    "novel://projects",
    {
      mimeType: "application/json",
      description: "全部小说项目列表。"
    },
    async (uri) => buildJsonResource(uri.toString(), services.projectService.listProjects())
  );

  server.registerResource(
    "project-detail",
    new ResourceTemplate("novel://project/{projectId}", {
      list: async () => ({
        resources: services.projectService.listProjects().map((project) => ({
          uri: `novel://project/${project.id}`,
          name: `${project.name} 项目详情`,
          mimeType: "application/json",
          description: "项目详情资源。"
        }))
      })
    }),
    {
      mimeType: "application/json",
      description: "项目详情。"
    },
    async (uri, variables) =>
      buildJsonResource(
        uri.toString(),
        services.projectService.getProject(String(variables.projectId))
      )
  );

  registerProjectScopedResource(server, services, "characters", "人物列表", (projectId) =>
    services.characterService.listCharacters(projectId)
  );
  registerProjectScopedResource(server, services, "world", "世界观列表", (projectId) =>
    services.worldService.listWorldItems(projectId)
  );
  registerProjectScopedResource(server, services, "chapters", "章节列表", (projectId) =>
    services.chapterService.listChapters(projectId)
  );
  registerProjectScopedResource(
    server,
    services,
    "foreshadowings",
    "伏笔列表",
    (projectId) => services.foreshadowingService.listForeshadowings(projectId)
  );
  registerProjectScopedResource(server, services, "timeline", "时间线列表", (projectId) =>
    services.timelineService.getTimeline(projectId)
  );
  registerProjectScopedResource(server, services, "rules", "写作规则列表", (projectId) =>
    services.projectService.listWritingRules(projectId)
  );
}

function registerProjectScopedResource(
  server: McpServer,
  services: AppServices,
  suffix: string,
  label: string,
  read: (projectId: string) => unknown
): void {
  server.registerResource(
    `project-${suffix}`,
    new ResourceTemplate(`novel://project/{projectId}/${suffix}`, {
      list: async () => ({
        resources: services.projectService.listProjects().map((project) => ({
          uri: `novel://project/${project.id}/${suffix}`,
          name: `${project.name}${label}`,
          mimeType: "application/json",
          description: label
        }))
      })
    }),
    {
      mimeType: "application/json",
      description: label
    },
    async (uri, variables) =>
      buildJsonResource(uri.toString(), read(String(variables.projectId)))
  );
}

function buildJsonResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}
