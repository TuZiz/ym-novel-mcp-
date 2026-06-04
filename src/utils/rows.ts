import type {
  CanonFact,
  Chapter,
  ChapterOutline,
  Character,
  CharacterRelationship,
  Foreshadowing,
  Project,
  TimelineEvent,
  Volume,
  WorldItem,
  WritingRule
} from "../types/novel.js";
import { parseStringArray } from "./text.js";

type Row = Record<string, unknown>;

function mapBaseRow(row: Row) {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapProjectRow(row: Row): Project {
  return {
    ...mapBaseRow(row),
    name: String(row.name),
    genre: (row.genre as string | null) ?? null,
    platform: (row.platform as string | null) ?? null,
    targetWords: (row.target_words as number | null) ?? null,
    currentWords: Number(row.current_words ?? 0),
    style: (row.style as string | null) ?? null,
    status: String(row.status)
  };
}

export function mapWorldItemRow(row: Row): WorldItem {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    type: String(row.type),
    name: String(row.name),
    content: String(row.content),
    importance: Number(row.importance ?? 0),
    tags: parseStringArray(row.tags)
  };
}

export function mapCharacterRow(row: Row): Character {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    name: String(row.name),
    aliases: parseStringArray(row.aliases),
    role: (row.role as string | null) ?? null,
    personality: (row.personality as string | null) ?? null,
    motivation: (row.motivation as string | null) ?? null,
    ability: (row.ability as string | null) ?? null,
    appearance: (row.appearance as string | null) ?? null,
    relationshipSummary: (row.relationship_summary as string | null) ?? null,
    currentState: (row.current_state as string | null) ?? null,
    powerLevel: (row.power_level as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    status: String(row.status),
    firstAppearanceChapter: (row.first_appearance_chapter as number | null) ?? null,
    lastAppearanceChapter: (row.last_appearance_chapter as number | null) ?? null
  };
}

export function mapCharacterRelationshipRow(row: Row): CharacterRelationship {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    characterAId: String(row.character_a_id),
    characterBId: String(row.character_b_id),
    relationshipType: String(row.relationship_type),
    description: (row.description as string | null) ?? null,
    currentState: (row.current_state as string | null) ?? null,
    tensionLevel: (row.tension_level as number | null) ?? null,
    updatedChapterId: (row.updated_chapter_id as string | null) ?? null
  };
}

export function mapVolumeRow(row: Row): Volume {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    volumeIndex: Number(row.volume_index),
    title: String(row.title),
    goal: (row.goal as string | null) ?? null,
    conflict: (row.conflict as string | null) ?? null,
    startChapter: (row.start_chapter as number | null) ?? null,
    endChapter: (row.end_chapter as number | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    status: String(row.status)
  };
}

export function mapChapterOutlineRow(row: Row): ChapterOutline {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    volumeId: (row.volume_id as string | null) ?? null,
    chapterIndex: Number(row.chapter_index),
    title: String(row.title),
    goal: (row.goal as string | null) ?? null,
    conflict: (row.conflict as string | null) ?? null,
    keyEvents: (row.key_events as string | null) ?? null,
    requiredCharacters: parseStringArray(row.required_characters),
    requiredForeshadowing: parseStringArray(row.required_foreshadowing),
    endingHook: (row.ending_hook as string | null) ?? null,
    status: String(row.status)
  };
}

export function mapChapterRow(row: Row): Chapter {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    volumeId: (row.volume_id as string | null) ?? null,
    chapterIndex: Number(row.chapter_index),
    title: String(row.title),
    content: String(row.content),
    summary: (row.summary as string | null) ?? null,
    wordCount: Number(row.word_count ?? 0),
    opening: (row.opening as string | null) ?? null,
    ending: (row.ending as string | null) ?? null,
    hook: (row.hook as string | null) ?? null,
    involvedCharacters: parseStringArray(row.involved_characters),
    involvedWorldItems: parseStringArray(row.involved_world_items),
    status: String(row.status)
  };
}

export function mapForeshadowingRow(row: Row): Foreshadowing {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    title: String(row.title),
    description: String(row.description),
    introducedChapterId: (row.introduced_chapter_id as string | null) ?? null,
    expectedResolveChapter: (row.expected_resolve_chapter as number | null) ?? null,
    resolvedChapterId: (row.resolved_chapter_id as string | null) ?? null,
    status: String(row.status),
    importance: Number(row.importance ?? 0),
    relatedCharacters: parseStringArray(row.related_characters),
    relatedWorldItems: parseStringArray(row.related_world_items),
    notes: (row.notes as string | null) ?? null
  };
}

export function mapTimelineEventRow(row: Row): TimelineEvent {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    chapterId: (row.chapter_id as string | null) ?? null,
    eventOrder: Number(row.event_order),
    title: String(row.title),
    description: String(row.description),
    involvedCharacters: parseStringArray(row.involved_characters),
    location: (row.location as string | null) ?? null,
    impact: (row.impact as string | null) ?? null
  };
}

export function mapCanonFactRow(row: Row): CanonFact {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    sourceType: String(row.source_type),
    sourceId: (row.source_id as string | null) ?? null,
    factType: String(row.fact_type),
    content: String(row.content),
    confidence: Number(row.confidence ?? 0),
    importance: Number(row.importance ?? 0)
  };
}

export function mapWritingRuleRow(row: Row): WritingRule {
  return {
    ...mapBaseRow(row),
    projectId: String(row.project_id),
    ruleType: String(row.rule_type),
    content: String(row.content),
    priority: Number(row.priority ?? 0),
    enabled: Boolean(row.enabled)
  };
}
