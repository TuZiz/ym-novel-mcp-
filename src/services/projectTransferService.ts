import type Database from "better-sqlite3";
import * as z from "zod/v4";
import { rebuildProjectFtsIndexes } from "../db/fts.js";
import type {
  ExportedProjectData,
  ImportProjectInput,
  ImportProjectResult
} from "../types/novel.js";
import { AppError } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import {
  mapCanonFactRow,
  mapChapterOutlineRow,
  mapChapterRow,
  mapCharacterRelationshipRow,
  mapCharacterRow,
  mapForeshadowingRow,
  mapNameBankRow,
  mapProjectBibleRow,
  mapTimelineEventRow,
  mapVolumeRow,
  mapWorldItemRow,
  mapWritingRuleRow
} from "../utils/rows.js";
import {
  countWords,
  excerptEnd,
  excerptStart,
  nowIso,
  serializeStringArray,
  uniqueStrings
} from "../utils/text.js";
import { ProjectService } from "./projectService.js";

const timestampSchema = z.string().min(1);

const baseRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

const projectSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  genre: z.string().nullable(),
  platform: z.string().nullable(),
  targetWords: z.number().int().nullable(),
  chapterWordTarget: z.number().int().nullable().optional().default(null),
  minChapterWords: z.number().int().nullable().optional().default(null),
  maxChapterWords: z.number().int().nullable().optional().default(null),
  currentWords: z.number().int().nonnegative(),
  style: z.string().nullable(),
  status: z.string()
});

const worldItemSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  content: z.string().min(1),
  importance: z.number().int(),
  tags: z.array(z.string())
});

const characterSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  role: z.string().nullable(),
  personality: z.string().nullable(),
  motivation: z.string().nullable(),
  ability: z.string().nullable(),
  appearance: z.string().nullable(),
  relationshipSummary: z.string().nullable(),
  currentState: z.string().nullable(),
  powerLevel: z.string().nullable(),
  location: z.string().nullable(),
  characterArc: z.string().nullable().optional().default(null),
  weakness: z.string().nullable().optional().default(null),
  secret: z.string().nullable().optional().default(null),
  voice: z.string().nullable().optional().default(null),
  speechHabits: z.string().nullable().optional().default(null),
  moralCode: z.string().nullable().optional().default(null),
  relationshipGoal: z.string().nullable().optional().default(null),
  growthStage: z.string().nullable().optional().default(null),
  firstScenePlan: z.string().nullable().optional().default(null),
  status: z.string(),
  firstAppearanceChapter: z.number().int().nullable(),
  lastAppearanceChapter: z.number().int().nullable()
});

const relationshipSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  characterAId: z.string().min(1),
  characterBId: z.string().min(1),
  relationshipType: z.string().min(1),
  description: z.string().nullable(),
  currentState: z.string().nullable(),
  tensionLevel: z.number().int().nullable(),
  updatedChapterId: z.string().nullable()
});

const volumeSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  volumeIndex: z.number().int(),
  title: z.string().min(1),
  goal: z.string().nullable(),
  conflict: z.string().nullable(),
  startChapter: z.number().int().nullable(),
  endChapter: z.number().int().nullable(),
  summary: z.string().nullable(),
  status: z.string()
});

const chapterOutlineSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  volumeId: z.string().nullable(),
  chapterIndex: z.number().int(),
  title: z.string().min(1),
  goal: z.string().nullable(),
  conflict: z.string().nullable(),
  keyEvents: z.string().nullable(),
  requiredCharacters: z.array(z.string()),
  requiredForeshadowing: z.array(z.string()),
  endingHook: z.string().nullable(),
  status: z.string()
});

const chapterSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  volumeId: z.string().nullable(),
  chapterIndex: z.number().int(),
  title: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().nullable(),
  wordCount: z.number().int().nonnegative(),
  opening: z.string().nullable(),
  ending: z.string().nullable(),
  hook: z.string().nullable(),
  involvedCharacters: z.array(z.string()),
  involvedWorldItems: z.array(z.string()),
  status: z.string()
});

const foreshadowingSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  introducedChapterId: z.string().nullable(),
  expectedResolveChapter: z.number().int().nullable(),
  resolvedChapterId: z.string().nullable(),
  status: z.string(),
  importance: z.number().int(),
  relatedCharacters: z.array(z.string()),
  relatedWorldItems: z.array(z.string()),
  notes: z.string().nullable()
});

const timelineEventSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  chapterId: z.string().nullable(),
  eventOrder: z.number().int(),
  title: z.string().min(1),
  description: z.string().min(1),
  involvedCharacters: z.array(z.string()),
  location: z.string().nullable(),
  impact: z.string().nullable()
});

const canonFactSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().nullable(),
  factType: z.string().min(1),
  content: z.string().min(1),
  confidence: z.number(),
  importance: z.number().int()
});

const writingRuleSchema = baseRecordSchema.extend({
  projectId: z.string().min(1),
  ruleType: z.string().min(1),
  content: z.string().min(1),
  priority: z.number().int(),
  enabled: z.boolean()
});

const projectBibleSchema = z.object({
  projectId: z.string().min(1),
  premise: z.string().nullable(),
  logline: z.string().nullable(),
  coreHook: z.string().nullable(),
  targetReader: z.string().nullable(),
  genreFormula: z.string().nullable(),
  pov: z.string().nullable(),
  tone: z.string().nullable(),
  taboo: z.string().nullable(),
  endingDirection: z.string().nullable(),
  longTermConflict: z.string().nullable(),
  chapterWordTarget: z.number().int().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

const nameBankSchema = baseRecordSchema.extend({
  projectId: z.string().nullable(),
  era: z.string().nullable(),
  region: z.string().nullable(),
  surnamePool: z.array(z.string()),
  givenNamePool: z.array(z.string()),
  bannedTokens: z.array(z.string()),
  bannedFullNames: z.array(z.string()),
  style: z.string().nullable()
});

const exportedProjectDataSchema = z.object({
  project: projectSchema,
  projectBible: projectBibleSchema.nullable().optional().default(null),
  nameBanks: z.array(nameBankSchema).optional().default([]),
  worldItems: z.array(worldItemSchema).default([]),
  characters: z.array(characterSchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  volumes: z.array(volumeSchema).default([]),
  chapterOutlines: z.array(chapterOutlineSchema).default([]),
  chapters: z.array(chapterSchema).default([]),
  foreshadowings: z.array(foreshadowingSchema).default([]),
  timelineEvents: z.array(timelineEventSchema).default([]),
  canonFacts: z.array(canonFactSchema).default([]),
  writingRules: z.array(writingRuleSchema).default([])
});

type ParsedProjectData = z.infer<typeof exportedProjectDataSchema>;

type IdMaps = {
  projectId: string;
  worldItems: Map<string, string>;
  characters: Map<string, string>;
  relationships: Map<string, string>;
  volumes: Map<string, string>;
  chapterOutlines: Map<string, string>;
  chapters: Map<string, string>;
  foreshadowings: Map<string, string>;
  timelineEvents: Map<string, string>;
  canonFacts: Map<string, string>;
  writingRules: Map<string, string>;
  nameBanks: Map<string, string>;
};

export class ProjectTransferService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService
  ) {}

  exportProject(projectId: string): ExportedProjectData {
    this.projectService.ensureProjectExists(projectId);
    const projectBibleRow = this.db
      .prepare("SELECT * FROM project_bibles WHERE project_id = ?")
      .get(projectId) as Record<string, unknown> | undefined;

    return {
      project: this.projectService.getProject(projectId),
      projectBible: projectBibleRow ? mapProjectBibleRow(projectBibleRow) : null,
      nameBanks: this.listRows(
        "SELECT * FROM name_bank WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapNameBankRow
      ),
      worldItems: this.listRows(
        "SELECT * FROM world_items WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapWorldItemRow
      ),
      characters: this.listRows(
        "SELECT * FROM characters WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapCharacterRow
      ),
      relationships: this.listRows(
        "SELECT * FROM character_relationships WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapCharacterRelationshipRow
      ),
      volumes: this.listRows(
        "SELECT * FROM volumes WHERE project_id = ? ORDER BY volume_index ASC",
        projectId,
        mapVolumeRow
      ),
      chapterOutlines: this.listRows(
        "SELECT * FROM chapter_outlines WHERE project_id = ? ORDER BY chapter_index ASC",
        projectId,
        mapChapterOutlineRow
      ),
      chapters: this.listRows(
        "SELECT * FROM chapters WHERE project_id = ? ORDER BY chapter_index ASC",
        projectId,
        mapChapterRow
      ),
      foreshadowings: this.listRows(
        "SELECT * FROM foreshadowings WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapForeshadowingRow
      ),
      timelineEvents: this.listRows(
        "SELECT * FROM timeline_events WHERE project_id = ? ORDER BY event_order ASC, created_at ASC",
        projectId,
        mapTimelineEventRow
      ),
      canonFacts: this.listRows(
        "SELECT * FROM canon_facts WHERE project_id = ? ORDER BY created_at ASC",
        projectId,
        mapCanonFactRow
      ),
      writingRules: this.listRows(
        "SELECT * FROM writing_rules WHERE project_id = ? ORDER BY priority ASC, created_at ASC",
        projectId,
        mapWritingRuleRow
      )
    };
  }

  importProject(input: ImportProjectInput): ImportProjectResult {
    const data = exportedProjectDataSchema.parse(input.data);
    const mode = input.mode ?? "new_project";
    const maps = buildIdMaps(data, mode);
    const importedAt = nowIso();
    const transaction = this.db.transaction(() => {
      if (mode === "overwrite") {
        this.deleteProjectForOverwrite(maps.projectId);
      } else if (this.projectExists(maps.projectId)) {
        throw new AppError(
          `Generated project id ${maps.projectId} already exists.`,
          "IMPORT_CONFLICT"
        );
      }

      this.insertProject(data, maps, importedAt);
      this.insertProjectBible(data, maps, importedAt);
      this.insertNameBanks(data, maps);
      this.insertWorldItems(data, maps);
      this.insertCharacters(data, maps);
      this.insertRelationships(data, maps);
      this.insertVolumes(data, maps);
      this.insertChapterOutlines(data, maps);
      this.insertChapters(data, maps);
      this.insertForeshadowings(data, maps);
      this.insertTimelineEvents(data, maps);
      this.insertCanonFacts(data, maps);
      this.insertWritingRules(data, maps);
      rebuildProjectFtsIndexes(this.db, maps.projectId);
    });

    transaction();
    const project = this.projectService.refreshProjectWordCount(maps.projectId);

    return {
      mode,
      project,
      counts: {
        worldItems: data.worldItems.length,
        characters: data.characters.length,
        relationships: data.relationships.length,
        volumes: data.volumes.length,
        chapterOutlines: data.chapterOutlines.length,
        chapters: data.chapters.length,
        foreshadowings: data.foreshadowings.length,
        timelineEvents: data.timelineEvents.length,
        canonFacts: data.canonFacts.length,
        writingRules: data.writingRules.length,
      }
    };
  }

  private listRows<T>(
    sql: string,
    projectId: string,
    map: (row: Record<string, unknown>) => T
  ): T[] {
    const rows = this.db.prepare(sql).all(projectId) as Record<string, unknown>[];
    return rows.map(map);
  }

  private projectExists(projectId: string): boolean {
    const row = this.db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;

    return Boolean(row);
  }

  private deleteProjectForOverwrite(projectId: string): void {
    this.db.prepare("DELETE FROM chapters_fts WHERE project_id = ?").run(projectId);
    this.db.prepare("DELETE FROM world_items_fts WHERE project_id = ?").run(projectId);
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  }

  private insertProject(
    data: ParsedProjectData,
    maps: IdMaps,
    importedAt: string
  ): void {
    const timestamp = maps.projectId === data.project.id ? data.project.createdAt : importedAt;

    this.db
      .prepare(
        `INSERT INTO projects (
          id, name, genre, platform, target_words, chapter_word_target, min_chapter_words,
          max_chapter_words, current_words, style, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
      )
      .run(
        maps.projectId,
        data.project.name,
        data.project.genre,
        data.project.platform,
        data.project.targetWords,
        data.project.chapterWordTarget,
        data.project.minChapterWords,
        data.project.maxChapterWords,
        data.project.style,
        data.project.status,
        timestamp,
        importedAt
      );
  }

  private insertProjectBible(
    data: ParsedProjectData,
    maps: IdMaps,
    importedAt: string
  ): void {
    if (!data.projectBible) {
      return;
    }

    this.db
      .prepare(
        `INSERT INTO project_bibles (
          project_id, premise, logline, core_hook, target_reader, genre_formula, pov,
          tone, taboo, ending_direction, long_term_conflict, chapter_word_target,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        maps.projectId,
        data.projectBible.premise,
        data.projectBible.logline,
        data.projectBible.coreHook,
        data.projectBible.targetReader,
        data.projectBible.genreFormula,
        data.projectBible.pov,
        data.projectBible.tone,
        data.projectBible.taboo,
        data.projectBible.endingDirection,
        data.projectBible.longTermConflict,
        data.projectBible.chapterWordTarget,
        maps.projectId === data.projectBible.projectId
          ? data.projectBible.createdAt
          : importedAt,
        importedAt
      );
  }

  private insertNameBanks(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO name_bank (
        id, project_id, era, region, surname_pool, given_name_pool, banned_tokens,
        banned_full_names, style, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const bank of data.nameBanks) {
      insert.run(
        requiredMappedId(maps.nameBanks, bank.id, "name bank"),
        maps.projectId,
        bank.era,
        bank.region,
        serializeStringArray(uniqueStrings(bank.surnamePool)),
        serializeStringArray(uniqueStrings(bank.givenNamePool)),
        serializeStringArray(uniqueStrings(bank.bannedTokens)),
        serializeStringArray(uniqueStrings(bank.bannedFullNames)),
        bank.style,
        bank.createdAt,
        bank.updatedAt
      );
    }
  }

  private insertWorldItems(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO world_items (
        id, project_id, type, name, content, importance, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of data.worldItems) {
      insert.run(
        requiredMappedId(maps.worldItems, item.id, "world item"),
        maps.projectId,
        item.type,
        item.name,
        item.content,
        item.importance,
        serializeStringArray(uniqueStrings(item.tags)),
        item.createdAt,
        item.updatedAt
      );
    }
  }

  private insertCharacters(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO characters (
        id, project_id, name, aliases, role, personality, motivation, ability, appearance,
        relationship_summary, current_state, power_level, location, character_arc, weakness,
        secret, voice, speech_habits, moral_code, relationship_goal, growth_stage,
        first_scene_plan, status,
        first_appearance_chapter, last_appearance_chapter, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const character of data.characters) {
      insert.run(
        requiredMappedId(maps.characters, character.id, "character"),
        maps.projectId,
        character.name,
        serializeStringArray(uniqueStrings(character.aliases)),
        character.role,
        character.personality,
        character.motivation,
        character.ability,
        character.appearance,
        character.relationshipSummary,
        character.currentState,
        character.powerLevel,
        character.location,
        character.characterArc,
        character.weakness,
        character.secret,
        character.voice,
        character.speechHabits,
        character.moralCode,
        character.relationshipGoal,
        character.growthStage,
        character.firstScenePlan,
        character.status,
        character.firstAppearanceChapter,
        character.lastAppearanceChapter,
        character.createdAt,
        character.updatedAt
      );
    }
  }

  private insertRelationships(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO character_relationships (
        id, project_id, character_a_id, character_b_id, relationship_type, description,
        current_state, tension_level, updated_chapter_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const relationship of data.relationships) {
      insert.run(
        requiredMappedId(maps.relationships, relationship.id, "relationship"),
        maps.projectId,
        requiredMappedId(maps.characters, relationship.characterAId, "character"),
        requiredMappedId(maps.characters, relationship.characterBId, "character"),
        relationship.relationshipType,
        relationship.description,
        relationship.currentState,
        relationship.tensionLevel,
        optionalMappedId(maps.chapters, relationship.updatedChapterId),
        relationship.createdAt,
        relationship.updatedAt
      );
    }
  }

  private insertVolumes(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO volumes (
        id, project_id, volume_index, title, goal, conflict, start_chapter, end_chapter, summary, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const volume of data.volumes) {
      insert.run(
        requiredMappedId(maps.volumes, volume.id, "volume"),
        maps.projectId,
        volume.volumeIndex,
        volume.title,
        volume.goal,
        volume.conflict,
        volume.startChapter,
        volume.endChapter,
        volume.summary,
        volume.status,
        volume.createdAt,
        volume.updatedAt
      );
    }
  }

  private insertChapterOutlines(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO chapter_outlines (
        id, project_id, volume_id, chapter_index, title, goal, conflict, key_events,
        required_characters, required_foreshadowing, ending_hook, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const outline of data.chapterOutlines) {
      insert.run(
        requiredMappedId(maps.chapterOutlines, outline.id, "chapter outline"),
        maps.projectId,
        optionalMappedId(maps.volumes, outline.volumeId),
        outline.chapterIndex,
        outline.title,
        outline.goal,
        outline.conflict,
        outline.keyEvents,
        serializeStringArray(remapRefs(outline.requiredCharacters, maps.characters)),
        serializeStringArray(
          remapRefs(outline.requiredForeshadowing, maps.foreshadowings)
        ),
        outline.endingHook,
        outline.status,
        outline.createdAt,
        outline.updatedAt
      );
    }
  }

  private insertChapters(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO chapters (
        id, project_id, volume_id, chapter_index, title, content, summary, word_count, opening, ending,
        hook, involved_characters, involved_world_items, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const chapter of data.chapters) {
      insert.run(
        requiredMappedId(maps.chapters, chapter.id, "chapter"),
        maps.projectId,
        optionalMappedId(maps.volumes, chapter.volumeId),
        chapter.chapterIndex,
        chapter.title,
        chapter.content,
        chapter.summary,
        countWords(chapter.content),
        excerptStart(chapter.content),
        excerptEnd(chapter.content),
        chapter.hook,
        serializeStringArray(remapRefs(chapter.involvedCharacters, maps.characters)),
        serializeStringArray(remapRefs(chapter.involvedWorldItems, maps.worldItems)),
        chapter.status,
        chapter.createdAt,
        chapter.updatedAt
      );
    }
  }

  private insertForeshadowings(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO foreshadowings (
        id, project_id, title, description, introduced_chapter_id, expected_resolve_chapter,
        resolved_chapter_id, status, importance, related_characters, related_world_items, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const foreshadowing of data.foreshadowings) {
      insert.run(
        requiredMappedId(maps.foreshadowings, foreshadowing.id, "foreshadowing"),
        maps.projectId,
        foreshadowing.title,
        foreshadowing.description,
        optionalMappedId(maps.chapters, foreshadowing.introducedChapterId),
        foreshadowing.expectedResolveChapter,
        optionalMappedId(maps.chapters, foreshadowing.resolvedChapterId),
        foreshadowing.status,
        foreshadowing.importance,
        serializeStringArray(
          remapRefs(foreshadowing.relatedCharacters, maps.characters)
        ),
        serializeStringArray(
          remapRefs(foreshadowing.relatedWorldItems, maps.worldItems)
        ),
        foreshadowing.notes,
        foreshadowing.createdAt,
        foreshadowing.updatedAt
      );
    }
  }

  private insertTimelineEvents(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO timeline_events (
        id, project_id, chapter_id, event_order, title, description, involved_characters, location, impact, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const event of data.timelineEvents) {
      insert.run(
        requiredMappedId(maps.timelineEvents, event.id, "timeline event"),
        maps.projectId,
        optionalMappedId(maps.chapters, event.chapterId),
        event.eventOrder,
        event.title,
        event.description,
        serializeStringArray(remapRefs(event.involvedCharacters, maps.characters)),
        event.location,
        event.impact,
        event.createdAt,
        event.updatedAt
      );
    }
  }

  private insertCanonFacts(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO canon_facts (
        id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const fact of data.canonFacts) {
      insert.run(
        requiredMappedId(maps.canonFacts, fact.id, "canon fact"),
        maps.projectId,
        fact.sourceType,
        mapCanonSourceId(fact.sourceType, fact.sourceId, maps),
        fact.factType,
        fact.content,
        fact.confidence,
        fact.importance,
        fact.createdAt,
        fact.updatedAt
      );
    }
  }

  private insertWritingRules(data: ParsedProjectData, maps: IdMaps): void {
    const insert = this.db.prepare(
      `INSERT INTO writing_rules (
        id, project_id, rule_type, content, priority, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const rule of data.writingRules) {
      insert.run(
        requiredMappedId(maps.writingRules, rule.id, "writing rule"),
        maps.projectId,
        rule.ruleType,
        rule.content,
        rule.priority,
        rule.enabled ? 1 : 0,
        rule.createdAt,
        rule.updatedAt
      );
    }
  }
}

function buildIdMaps(
  data: ParsedProjectData,
  mode: "new_project" | "overwrite"
): IdMaps {
  const keepOriginalIds = mode === "overwrite";

  return {
    projectId: keepOriginalIds ? data.project.id : createId("project"),
    worldItems: buildIdMap(data.worldItems, "world", keepOriginalIds),
    characters: buildIdMap(data.characters, "character", keepOriginalIds),
    relationships: buildIdMap(data.relationships, "relationship", keepOriginalIds),
    volumes: buildIdMap(data.volumes, "volume", keepOriginalIds),
    chapterOutlines: buildIdMap(data.chapterOutlines, "outline", keepOriginalIds),
    chapters: buildIdMap(data.chapters, "chapter", keepOriginalIds),
    foreshadowings: buildIdMap(data.foreshadowings, "foreshadowing", keepOriginalIds),
    timelineEvents: buildIdMap(data.timelineEvents, "timeline", keepOriginalIds),
    canonFacts: buildIdMap(data.canonFacts, "canon", keepOriginalIds),
    writingRules: buildIdMap(data.writingRules, "rule", keepOriginalIds),
    nameBanks: buildIdMap(data.nameBanks, "namebank", keepOriginalIds)
  };
}

function buildIdMap(
  records: Array<{ id: string }>,
  prefix: string,
  keepOriginalIds: boolean
): Map<string, string> {
  return new Map(
    records.map((record) => [
      record.id,
      keepOriginalIds ? record.id : createId(prefix)
    ])
  );
}

function requiredMappedId(
  map: Map<string, string>,
  originalId: string,
  label: string
): string {
  const mapped = map.get(originalId);
  if (!mapped) {
    throw new AppError(`Missing imported ${label} reference: ${originalId}`, "BAD_IMPORT");
  }

  return mapped;
}

function optionalMappedId(
  map: Map<string, string>,
  originalId: string | null
): string | null {
  if (!originalId) {
    return null;
  }

  return map.get(originalId) ?? originalId;
}

function remapRefs(refs: string[], map: Map<string, string>): string[] {
  return uniqueStrings(refs.map((ref) => map.get(ref) ?? ref));
}

function mapCanonSourceId(
  sourceType: string,
  sourceId: string | null,
  maps: IdMaps
): string | null {
  if (!sourceId) {
    return null;
  }

  if (sourceType === "project") {
    return maps.projectId;
  }

  if (sourceType === "world_item") {
    return optionalMappedId(maps.worldItems, sourceId);
  }

  if (sourceType === "character") {
    return optionalMappedId(maps.characters, sourceId);
  }

  if (sourceType === "chapter") {
    return optionalMappedId(maps.chapters, sourceId);
  }

  if (sourceType === "foreshadowing") {
    return optionalMappedId(maps.foreshadowings, sourceId);
  }

  if (sourceType === "timeline_event") {
    return optionalMappedId(maps.timelineEvents, sourceId);
  }

  return sourceId;
}
