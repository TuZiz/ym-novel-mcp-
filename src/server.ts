import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, type AppConfig } from "./config/index.js";
import { NovelDatabase } from "./db/index.js";
import { registerNovelPrompts } from "./prompts/novelPrompts.js";
import { registerNovelResources } from "./resources/novelResources.js";
import { ChapterService } from "./services/chapterService.js";
import { CharacterService } from "./services/characterService.js";
import { ContinuityService } from "./services/continuityService.js";
import { ForeshadowingService } from "./services/foreshadowingService.js";
import { OutlineService } from "./services/outlineService.js";
import { ProjectService } from "./services/projectService.js";
import { SearchService } from "./services/searchService.js";
import { TimelineService } from "./services/timelineService.js";
import { WorldService } from "./services/worldService.js";
import { WritingContextService } from "./services/writingContextService.js";
import type { AppServices } from "./types/app.js";
import { registerChapterTools } from "./tools/chapterTools.js";
import { registerCharacterTools } from "./tools/characterTools.js";
import { registerContinuityTools } from "./tools/continuityTools.js";
import { registerForeshadowingTools } from "./tools/foreshadowingTools.js";
import { registerOutlineTools } from "./tools/outlineTools.js";
import { registerProjectTools } from "./tools/projectTools.js";
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
    version: "0.1.0"
  });

  registerProjectTools(server, services);
  registerWorldTools(server, services);
  registerCharacterTools(server, services);
  registerOutlineTools(server, services);
  registerChapterTools(server, services);
  registerForeshadowingTools(server, services);
  registerTimelineTools(server, services);
  registerContinuityTools(server, services);
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
    }
  };
}

function createServices(database: NovelDatabase): AppServices {
  const projectService = new ProjectService(database.db);
  const outlineService = new OutlineService(database.db, projectService);
  const chapterService = new ChapterService(database.db, projectService, outlineService);
  const worldService = new WorldService(database.db, projectService);
  const characterService = new CharacterService(database.db, projectService);
  const foreshadowingService = new ForeshadowingService(
    database.db,
    projectService,
    chapterService
  );
  const timelineService = new TimelineService(
    database.db,
    projectService,
    chapterService
  );
  const searchService = new SearchService(
    characterService,
    worldService,
    chapterService,
    foreshadowingService
  );
  const continuityService = new ContinuityService(
    projectService,
    characterService,
    worldService,
    foreshadowingService,
    timelineService,
    chapterService,
    searchService
  );
  const writingContextService = new WritingContextService(
    projectService,
    outlineService,
    chapterService,
    characterService,
    worldService,
    foreshadowingService,
    timelineService,
    searchService
  );

  return {
    projectService,
    worldService,
    characterService,
    outlineService,
    chapterService,
    foreshadowingService,
    timelineService,
    searchService,
    continuityService,
    writingContextService
  };
}
