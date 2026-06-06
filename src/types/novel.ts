export type Timestamp = string;

export interface BaseRecord {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project extends BaseRecord {
  name: string;
  genre: string | null;
  platform: string | null;
  targetWords: number | null;
  currentWords: number;
  style: string | null;
  status: string;
}

export interface WorldItem extends BaseRecord {
  projectId: string;
  type: string;
  name: string;
  content: string;
  importance: number;
  tags: string[];
}

export interface Character extends BaseRecord {
  projectId: string;
  name: string;
  aliases: string[];
  role: string | null;
  personality: string | null;
  motivation: string | null;
  ability: string | null;
  appearance: string | null;
  relationshipSummary: string | null;
  currentState: string | null;
  powerLevel: string | null;
  location: string | null;
  status: string;
  firstAppearanceChapter: number | null;
  lastAppearanceChapter: number | null;
}

export interface CharacterRelationship extends BaseRecord {
  projectId: string;
  characterAId: string;
  characterBId: string;
  relationshipType: string;
  description: string | null;
  currentState: string | null;
  tensionLevel: number | null;
  updatedChapterId: string | null;
}

export interface Volume extends BaseRecord {
  projectId: string;
  volumeIndex: number;
  title: string;
  goal: string | null;
  conflict: string | null;
  startChapter: number | null;
  endChapter: number | null;
  summary: string | null;
  status: string;
}

export interface ChapterOutline extends BaseRecord {
  projectId: string;
  volumeId: string | null;
  chapterIndex: number;
  title: string;
  goal: string | null;
  conflict: string | null;
  keyEvents: string | null;
  requiredCharacters: string[];
  requiredForeshadowing: string[];
  endingHook: string | null;
  status: string;
}

export interface Chapter extends BaseRecord {
  projectId: string;
  volumeId: string | null;
  chapterIndex: number;
  title: string;
  content: string;
  summary: string | null;
  wordCount: number;
  opening: string | null;
  ending: string | null;
  hook: string | null;
  involvedCharacters: string[];
  involvedWorldItems: string[];
  status: string;
}

export interface Foreshadowing extends BaseRecord {
  projectId: string;
  title: string;
  description: string;
  introducedChapterId: string | null;
  expectedResolveChapter: number | null;
  resolvedChapterId: string | null;
  status: string;
  importance: number;
  relatedCharacters: string[];
  relatedWorldItems: string[];
  notes: string | null;
}

export interface TimelineEvent extends BaseRecord {
  projectId: string;
  chapterId: string | null;
  eventOrder: number;
  title: string;
  description: string;
  involvedCharacters: string[];
  location: string | null;
  impact: string | null;
}

export interface CanonFact extends BaseRecord {
  projectId: string;
  sourceType: string;
  sourceId: string | null;
  factType: string;
  content: string;
  confidence: number;
  importance: number;
}

export interface WritingRule extends BaseRecord {
  projectId: string;
  ruleType: string;
  content: string;
  priority: number;
  enabled: boolean;
}

export type ExperienceScope =
  | "global"
  | "project"
  | "character"
  | "world"
  | "chapter"
  | "style"
  | "workflow";

export type ExperienceType =
  | "best_practice"
  | "avoid_pattern"
  | "user_preference"
  | "correction"
  | "successful_solution"
  | "failed_solution"
  | "style_rule"
  | "workflow_rule"
  | "canon_decision";

export interface ExperienceRecord extends BaseRecord {
  projectId: string | null;
  scope: ExperienceScope;
  type: ExperienceType;
  title: string;
  content: string;
  reason: string | null;
  tags: string[];
  sourceType: string | null;
  sourceId: string | null;
  confidence: number;
  score: number;
  usageCount: number;
  lastUsedAt: string | null;
  status: string;
}

export type FeedbackAction =
  | "accepted"
  | "rejected"
  | "corrected"
  | "improved"
  | "bad_result"
  | "good_result";

export interface FeedbackEvent {
  id: string;
  projectId: string | null;
  targetType: string;
  targetId: string | null;
  rating: number | null;
  feedback: string;
  action: FeedbackAction | null;
  createdAt: Timestamp;
}

export type WorkflowRunResult =
  | "success"
  | "partial"
  | "failed"
  | "user_rejected"
  | "user_accepted";

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowType: string;
  inputSummary: string | null;
  outputSummary: string | null;
  result: WorkflowRunResult;
  notes: string | null;
  createdAt: Timestamp;
}

export interface ExperienceSearchResultItem {
  id: string;
  scope: ExperienceScope;
  type: ExperienceType;
  title: string;
  content: string;
  reason?: string;
  tags: string[];
  confidence: number;
  score: number;
  usageCount: number;
}

export interface SearchExperiencesResult {
  query: string;
  results: ExperienceSearchResultItem[];
}

export interface LearningContextItem extends ExperienceSearchResultItem {
  projectId: string | null;
}

export interface LearningContext {
  bestPractices: LearningContextItem[];
  avoidPatterns: LearningContextItem[];
  userPreferences: LearningContextItem[];
  styleRules: LearningContextItem[];
  workflowRules: LearningContextItem[];
  canonDecisions: LearningContextItem[];
  instruction: string;
}

export interface ProjectSnapshot extends BaseRecord {
  projectId: string;
  label: string | null;
  notes: string | null;
  content: ExportedProjectData;
}

export interface ProjectSnapshotSummary extends BaseRecord {
  projectId: string;
  label: string | null;
  notes: string | null;
}

export interface ContinuityWarning {
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
  relatedId?: string;
}

export interface ContinuityCheckResult {
  ok: boolean;
  warnings: ContinuityWarning[];
}

export interface NextChapterContext {
  project: Project;
  currentVolume: Volume | null;
  chapterOutline: ChapterOutline | null;
  recentChapters: Chapter[];
  relevantCharacters: Character[];
  relevantWorldItems: WorldItem[];
  openForeshadowings: Foreshadowing[];
  overdueForeshadowings: Foreshadowing[];
  timeline: TimelineEvent[];
  recentTimelineEvents: TimelineEvent[];
  canonFacts: CanonFact[];
  writingRules: WritingRule[];
  learningContext: LearningContext;
  searchHints: string[];
  instruction: string;
}

export interface ExportedProjectData {
  project: Project;
  worldItems: WorldItem[];
  characters: Character[];
  relationships: CharacterRelationship[];
  volumes: Volume[];
  chapterOutlines: ChapterOutline[];
  chapters: Chapter[];
  foreshadowings: Foreshadowing[];
  timelineEvents: TimelineEvent[];
  canonFacts: CanonFact[];
  writingRules: WritingRule[];
}

export interface ImportProjectInput {
  data: unknown;
  mode?: "new_project" | "overwrite";
}

export interface ImportProjectResult {
  mode: "new_project" | "overwrite";
  project: Project;
  counts: {
    worldItems: number;
    characters: number;
    relationships: number;
    volumes: number;
    chapterOutlines: number;
    chapters: number;
    foreshadowings: number;
    timelineEvents: number;
    canonFacts: number;
    writingRules: number;
  };
}

export interface OutlineSuggestion {
  title: string;
  goal: string;
  conflict: string;
  keyEvents: string[];
  requiredCharacters: string[];
  requiredForeshadowing: string[];
  endingHook: string;
}

export interface PlanNextChapterInput {
  projectId: string;
  chapterIndex: number;
  volumeId?: string;
  focus?: string;
}

export interface PlanNextChapterResult {
  outlineSuggestion: OutlineSuggestion;
  context: NextChapterContext;
  instruction: string;
}

export interface RecordExperienceInput {
  projectId?: string;
  scope: ExperienceScope;
  type: ExperienceType;
  title: string;
  content: string;
  reason?: string;
  tags?: string[];
  sourceType?: string;
  sourceId?: string;
  confidence?: number;
}

export interface SearchExperiencesInput {
  projectId?: string;
  query: string;
  scope?: ExperienceScope;
  type?: ExperienceType;
  tags?: string[];
  limit?: number;
}

export interface RecordFeedbackInput {
  projectId?: string;
  targetType: string;
  targetId?: string;
  rating?: number;
  feedback: string;
  action?: FeedbackAction;
}

export interface PromoteExperienceInput {
  experienceId: string;
  amount?: number;
  reason?: string;
}

export interface SuppressExperienceInput {
  experienceId: string;
  amount?: number;
  reason?: string;
}

export interface GetLearningContextInput {
  projectId?: string;
  query?: string;
  chapterIndex?: number;
  focus?: string;
  limit?: number;
}

export interface RecordWorkflowRunInput {
  projectId: string;
  workflowType: string;
  inputSummary?: string;
  outputSummary?: string;
  result: WorkflowRunResult;
  notes?: string;
}

export interface BuildPostChapterUpdatePromptInput {
  projectId: string;
  chapterIndex: number;
}

export interface ApplyPostChapterUpdateInput {
  projectId: string;
  chapterIndex: number;
  update: {
    summary?: string;
    hook?: string;
    characterUpdates?: Array<{
      characterId?: string;
      name?: string;
      currentState?: string;
      powerLevel?: string;
      location?: string;
      status?: string;
      relationshipSummary?: string;
      lastAppearanceChapter?: number;
    }>;
    newWorldItems?: Array<{
      type: string;
      name: string;
      content: string;
      importance?: number;
      tags?: string[];
    }>;
    newForeshadowings?: Array<{
      title: string;
      description: string;
      expectedResolveChapter?: number;
      importance?: number;
      relatedCharacters?: string[];
      relatedWorldItems?: string[];
      notes?: string;
    }>;
    resolvedForeshadowings?: Array<{
      foreshadowingId: string;
      resolvedChapterId?: string;
      notes?: string;
    }>;
    timelineEvents?: Array<{
      eventOrder?: number;
      title: string;
      description: string;
      involvedCharacters?: string[];
      location?: string;
      impact?: string;
    }>;
    canonFacts?: Array<{
      sourceType?: string;
      factType: string;
      content: string;
      confidence?: number;
      importance?: number;
    }>;
  };
}

export interface ApplyPostChapterUpdateWarning {
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface ApplyPostChapterUpdateResult {
  ok: boolean;
  updatedChapter?: Chapter;
  updatedCharacters: Character[];
  addedWorldItems: WorldItem[];
  addedForeshadowings: Foreshadowing[];
  resolvedForeshadowings: Foreshadowing[];
  addedTimelineEvents: TimelineEvent[];
  addedCanonFacts: CanonFact[];
  warnings: ApplyPostChapterUpdateWarning[];
}

export type SearchAllInclude =
  | "chapters"
  | "characters"
  | "world_items"
  | "foreshadowings"
  | "timeline"
  | "canon_facts";

export interface SearchAllInput {
  projectId: string;
  query: string;
  limit?: number;
  include?: SearchAllInclude[];
}

export interface SearchAllResultItem {
  type: SearchAllInclude;
  id: string;
  title: string;
  snippet: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchAllResult {
  query: string;
  results: SearchAllResultItem[];
}

export interface CreateProjectSnapshotInput {
  projectId: string;
  label?: string;
  notes?: string;
}

export interface ListProjectSnapshotsInput {
  projectId: string;
  limit?: number;
}

export interface CreateProjectInput {
  name: string;
  genre?: string;
  platform?: string;
  targetWords?: number;
  style?: string;
}

export interface UpdateProjectInput {
  name?: string;
  genre?: string | null;
  platform?: string | null;
  targetWords?: number | null;
  currentWords?: number;
  style?: string | null;
  status?: string;
}

export interface AddWorldItemInput {
  projectId: string;
  type: string;
  name: string;
  content: string;
  importance?: number;
  tags?: string[];
}

export interface SearchWorldItemsInput {
  projectId: string;
  query: string;
  type?: string;
  limit?: number;
}

export interface AddCharacterInput {
  projectId: string;
  name: string;
  aliases?: string[];
  role?: string;
  personality?: string;
  motivation?: string;
  ability?: string;
  appearance?: string;
  relationshipSummary?: string;
  currentState?: string;
  powerLevel?: string;
  location?: string;
}

export interface UpdateCharacterStateInput {
  projectId: string;
  characterId: string;
  currentState?: string;
  powerLevel?: string;
  location?: string;
  status?: string;
  lastAppearanceChapter?: number;
}

export interface AddCharacterRelationshipInput {
  projectId: string;
  characterAId: string;
  characterBId: string;
  relationshipType: string;
  description?: string;
  currentState?: string;
  tensionLevel?: number;
  updatedChapterId?: string;
}

export interface UpdateCharacterRelationshipInput {
  projectId: string;
  relationshipId: string;
  relationshipType?: string;
  description?: string | null;
  currentState?: string | null;
  tensionLevel?: number | null;
  updatedChapterId?: string | null;
}

export interface CreateVolumeInput {
  projectId: string;
  volumeIndex: number;
  title: string;
  goal?: string;
  conflict?: string;
  startChapter?: number;
  endChapter?: number;
  summary?: string;
  status?: string;
}

export interface UpdateVolumeInput {
  projectId: string;
  volumeId: string;
  title?: string;
  goal?: string | null;
  conflict?: string | null;
  startChapter?: number | null;
  endChapter?: number | null;
  summary?: string | null;
  status?: string;
}

export interface CreateChapterOutlineInput {
  projectId: string;
  volumeId?: string;
  chapterIndex: number;
  title: string;
  goal?: string;
  conflict?: string;
  keyEvents?: string;
  requiredCharacters?: string[];
  requiredForeshadowing?: string[];
  endingHook?: string;
  status?: string;
}

export interface UpdateChapterOutlineInput {
  projectId: string;
  outlineId: string;
  chapterIndex?: number;
  title?: string;
  goal?: string | null;
  conflict?: string | null;
  keyEvents?: string | null;
  requiredCharacters?: string[];
  requiredForeshadowing?: string[];
  endingHook?: string | null;
  status?: string;
}

export interface SaveChapterInput {
  projectId: string;
  volumeId?: string;
  chapterIndex: number;
  title: string;
  content: string;
  summary?: string;
  hook?: string;
  involvedCharacters?: string[];
  involvedWorldItems?: string[];
  status?: string;
}

export interface GetRecentChaptersInput {
  projectId: string;
  beforeChapterIndex?: number;
  limit?: number;
  includeContent?: boolean;
}

export interface UpdateChapterSummaryInput {
  projectId: string;
  chapterId: string;
  summary: string;
}

export interface AddForeshadowingInput {
  projectId: string;
  title: string;
  description: string;
  introducedChapterId?: string;
  expectedResolveChapter?: number;
  importance?: number;
  relatedCharacters?: string[];
  relatedWorldItems?: string[];
  notes?: string;
}

export interface ResolveForeshadowingInput {
  projectId: string;
  foreshadowingId: string;
  resolvedChapterId?: string;
  status?: string;
  notes?: string;
}

export interface AddTimelineEventInput {
  projectId: string;
  chapterId?: string;
  eventOrder: number;
  title: string;
  description: string;
  involvedCharacters?: string[];
  location?: string;
  impact?: string;
}

export interface CheckContinuityInput {
  projectId: string;
  draftContent: string;
  relatedCharacterIds?: string[];
  relatedWorldItemIds?: string[];
  chapterIndex?: number;
}

export interface BuildNextChapterContextInput {
  projectId: string;
  chapterIndex: number;
  volumeId?: string;
  focus?: string;
  recentChapterLimit?: number;
}
