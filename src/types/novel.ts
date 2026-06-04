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
  timeline: TimelineEvent[];
  writingRules: WritingRule[];
  instruction: string;
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
