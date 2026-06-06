import type { ChapterService } from "../services/chapterService.js";
import type { ChapterPipelineService } from "../services/chapterPipelineService.js";
import type { CharacterService } from "../services/characterService.js";
import type { ContinuityService } from "../services/continuityService.js";
import type { ForeshadowingService } from "../services/foreshadowingService.js";
import type { LearningMemoryService } from "../services/learningMemoryService.js";
import type { McpCallLogService } from "../services/mcpCallLogService.js";
import type { NameService } from "../services/nameService.js";
import type { OutlineService } from "../services/outlineService.js";
import type { ProjectBibleService } from "../services/projectBibleService.js";
import type { ProjectService } from "../services/projectService.js";
import type { ProjectSnapshotService } from "../services/projectSnapshotService.js";
import type { ProjectTransferService } from "../services/projectTransferService.js";
import type { SearchService } from "../services/searchService.js";
import type { TimelineService } from "../services/timelineService.js";
import type { WorldService } from "../services/worldService.js";
import type { WorkspaceExportService } from "../services/workspaceExportService.js";
import type { WritingContextService } from "../services/writingContextService.js";

export interface AppServices {
  projectService: ProjectService;
  projectTransferService: ProjectTransferService;
  projectSnapshotService: ProjectSnapshotService;
  projectBibleService: ProjectBibleService;
  workspaceExportService: WorkspaceExportService;
  worldService: WorldService;
  characterService: CharacterService;
  nameService: NameService;
  outlineService: OutlineService;
  chapterService: ChapterService;
  foreshadowingService: ForeshadowingService;
  timelineService: TimelineService;
  searchService: SearchService;
  learningMemoryService: LearningMemoryService;
  mcpCallLogService: McpCallLogService;
  continuityService: ContinuityService;
  writingContextService: WritingContextService;
  chapterPipelineService: ChapterPipelineService;
}
