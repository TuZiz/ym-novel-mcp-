import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, type AppConfig } from "./config/index.js";
import { NovelDatabase } from "./db/index.js";
import { registerNovelPrompts } from "./prompts/novelPrompts.js";
import { registerNovelResources } from "./resources/novelResources.js";
import { ChapterService } from "./services/chapterService.js";
import { ChapterPipelineService } from "./services/chapterPipelineService.js";
import { CharacterService } from "./services/characterService.js";
import { ContinuityService } from "./services/continuityService.js";
import { ForeshadowingService } from "./services/foreshadowingService.js";
import { LearningMemoryService } from "./services/learningMemoryService.js";
import { McpCallLogService } from "./services/mcpCallLogService.js";
import { OutlineService } from "./services/outlineService.js";
import { ProjectService } from "./services/projectService.js";
import { ProjectSnapshotService } from "./services/projectSnapshotService.js";
import { ProjectTransferService } from "./services/projectTransferService.js";
import { SearchService } from "./services/searchService.js";
import { TimelineService } from "./services/timelineService.js";
import { WorldService } from "./services/worldService.js";
import { WritingContextService } from "./services/writingContextService.js";
import type { AppServices } from "./types/app.js";
import { registerChapterTools } from "./tools/chapterTools.js";
import { registerCharacterTools } from "./tools/characterTools.js";
import { registerContinuityTools } from "./tools/continuityTools.js";
import { registerForeshadowingTools } from "./tools/foreshadowingTools.js";
import { registerLearningMemoryTools } from "./tools/learningMemoryTools.js";
import { registerOutlineTools } from "./tools/outlineTools.js";
import { registerProjectTools } from "./tools/projectTools.js";
import { registerSearchTools } from "./tools/searchTools.js";
import { registerTimelineTools } from "./tools/timelineTools.js";
import { registerWorldTools } from "./tools/worldTools.js";
import { registerWritingContextTools } from "./tools/writingContextTools.js";

export interface AppInstance {
  config: AppConfig;
  database: NovelDatabase;
  services: AppServices;
  server: McpServer;
  close(): Promise<void>;
}

export function createApp(overrides?: Partial<AppConfig>): AppInstance {
  const config = loadConfig(overrides);
  const database = new NovelDatabase(config.dbPath);
  const services = createServices(database);
  const server = new McpServer({
    name: "ym-novel-mcp",
    version: "0.1.0",
  });

  registerProjectTools(server, services);
  registerWorldTools(server, services);
  registerCharacterTools(server, services);
  registerOutlineTools(server, services);
  registerChapterTools(server, services);
  registerForeshadowingTools(server, services);
  registerTimelineTools(server, services);
  registerContinuityTools(server, services);
  registerSearchTools(server, services);
  registerLearningMemoryTools(server, services);
  registerWritingContextTools(server, services);
  registerNovelResources(server, services);
  registerNovelPrompts(server, services);

  return {
    config,
    database,
    services,
    server,
    async close() {
      await server.close();
      database.close();
    },
  };
}

function createServices(database: NovelDatabase): AppServices {
  const projectService = new ProjectService(database.db);
  const projectTransferService = new ProjectTransferService(
    database.db,
    projectService,
  );
  const projectSnapshotService = new ProjectSnapshotService(
    database.db,
    projectService,
    projectTransferService,
  );
  const outlineService = new OutlineService(database.db, projectService);
  const chapterService = new ChapterService(
    database.db,
    projectService,
    outlineService,
  );
  const worldService = new WorldService(database.db, projectService);
  const characterService = new CharacterService(database.db, projectService);
  const foreshadowingService = new ForeshadowingService(
    database.db,
    projectService,
    chapterService,
  );
  const timelineService = new TimelineService(
    database.db,
    projectService,
    chapterService,
  );
  const searchService = new SearchService(
    database.db,
    projectService,
    characterService,
    worldService,
    chapterService,
    foreshadowingService,
    timelineService,
  );
  const learningMemoryService = new LearningMemoryService(
    database.db,
    projectService,
  );
  const mcpCallLogService = new McpCallLogService(database.db);
  const continuityService = new ContinuityService(
    projectService,
    characterService,
    worldService,
    foreshadowingService,
    timelineService,
    chapterService,
    searchService,
    learningMemoryService,
  );
  const writingContextService = new WritingContextService(
    projectService,
    outlineService,
    chapterService,
    characterService,
    worldService,
    foreshadowingService,
    timelineService,
    searchService,
    learningMemoryService,
  );
  const chapterPipelineService = new ChapterPipelineService(
    database.db,
    projectService,
    chapterService,
    writingContextService,
    characterService,
    worldService,
    foreshadowingService,
    timelineService,
    searchService,
    learningMemoryService,
  );

  return {
    projectService,
    projectTransferService,
    projectSnapshotService,
    worldService,
    characterService,
    outlineService,
    chapterService,
    foreshadowingService,
    timelineService,
    searchService,
    learningMemoryService,
    mcpCallLogService,
    continuityService,
    writingContextService,
    chapterPipelineService,
  };
}
