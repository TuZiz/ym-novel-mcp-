import type Database from "better-sqlite3";
import type {
  CanonFact,
  Chapter,
  Character,
  Foreshadowing,
  SearchAllInclude,
  SearchAllInput,
  SearchAllResult,
  SearchAllResultItem,
  TimelineEvent,
  WorldItem,
} from "../types/novel.js";
import { ChapterService } from "./chapterService.js";
import { CharacterService } from "./characterService.js";
import { ForeshadowingService } from "./foreshadowingService.js";
import { ProjectService } from "./projectService.js";
import { TimelineService } from "./timelineService.js";
import { WorldService } from "./worldService.js";

const allSearchTypes: SearchAllInclude[] = [
  "chapters",
  "characters",
  "world_items",
  "foreshadowings",
  "timeline",
  "canon_facts",
];

export class SearchService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly characterService: CharacterService,
    private readonly worldService: WorldService,
    private readonly chapterService: ChapterService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly timelineService: TimelineService,
  ) {}

  searchEverything(
    projectId: string,
    query: string,
    limit = 5,
  ): {
    characters: Character[];
    worldItems: WorldItem[];
    chapters: Chapter[];
    foreshadowings: Foreshadowing[];
  } {
    return {
      characters: this.characterService.searchCharacters(
        projectId,
        query,
        limit,
      ),
      worldItems: this.worldService.searchWorldItems(
        projectId,
        query,
        undefined,
        limit,
      ),
      chapters: this.chapterService.searchChapters(projectId, query, limit),
      foreshadowings: this.foreshadowingService.searchForeshadowings(
        projectId,
        query,
        limit,
      ),
    };
  }

  searchAll(input: SearchAllInput): SearchAllResult {
    this.projectService.ensureProjectExists(input.projectId);

    const limit = input.limit ?? 20;
    const include = input.include?.length ? input.include : allSearchTypes;
    const results: SearchAllResultItem[] = [];

    if (include.includes("chapters")) {
      results.push(
        ...this.chapterService
          .searchChapters(input.projectId, input.query, limit)
          .map((chapter) => mapChapterResult(chapter, input.query)),
      );
    }

    if (include.includes("world_items")) {
      results.push(
        ...this.worldService
          .searchWorldItems(input.projectId, input.query, undefined, limit)
          .map((item) => mapWorldItemResult(item, input.query)),
      );
    }

    if (include.includes("characters")) {
      results.push(
        ...this.characterService
          .searchCharacters(input.projectId, input.query, limit)
          .map((character) => mapCharacterResult(character, input.query)),
      );
    }

    if (include.includes("foreshadowings")) {
      results.push(
        ...this.foreshadowingService
          .searchForeshadowings(input.projectId, input.query, limit)
          .map((item) => mapForeshadowingResult(item, input.query)),
      );
    }

    if (include.includes("timeline")) {
      results.push(
        ...this.timelineService
          .searchTimeline(input.projectId, input.query, limit)
          .map((event) => mapTimelineResult(event, input.query)),
      );
    }

    if (include.includes("canon_facts")) {
      results.push(
        ...this.searchCanonFacts(input.projectId, input.query, limit).map(
          (fact) => mapCanonFactResult(fact, input.query),
        ),
      );
    }

    return {
      query: input.query,
      results: results
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .slice(0, limit),
    };
  }

  resolveCharacters(projectId: string, refs: string[]): Character[] {
    const exactMap = new Map(
      this.characterService
        .listCharacters(projectId)
        .flatMap((character) => [
          [character.id, character],
          [character.name, character],
          ...character.aliases.map((alias) => [alias, character] as const),
        ]),
    );

    const resolved = refs
      .map((ref) => exactMap.get(ref))
      .filter((item): item is Character => Boolean(item));

    return dedupeById(resolved);
  }

  resolveWorldItems(projectId: string, refs: string[]): WorldItem[] {
    const exactMap = new Map(
      this.worldService.listWorldItems(projectId).flatMap((item) => [
        [item.id, item],
        [item.name, item],
      ]),
    );

    const resolved = refs
      .map((ref) => exactMap.get(ref))
      .filter((item): item is WorldItem => Boolean(item));

    return dedupeById(resolved);
  }

  resolveForeshadowings(projectId: string, refs: string[]): Foreshadowing[] {
    const exactMap = new Map(
      this.foreshadowingService
        .listForeshadowings(projectId)
        .flatMap((item) => [
          [item.id, item],
          [item.title, item],
        ]),
    );

    const resolved = refs
      .map((ref) => exactMap.get(ref))
      .filter((item): item is Foreshadowing => Boolean(item));

    return dedupeById(resolved);
  }

  private searchCanonFacts(
    projectId: string,
    query: string,
    limit: number,
  ): CanonFact[] {
    if (!query.trim()) {
      return this.projectService.listCanonFacts(projectId, limit);
    }

    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM canon_facts
        WHERE project_id = ?
          AND (fact_type LIKE ? OR content LIKE ? OR source_type LIKE ?)
        ORDER BY importance DESC, confidence DESC, created_at DESC
        LIMIT ?`,
      )
      .all(projectId, like, like, like, limit) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      sourceType: String(row.source_type),
      sourceId: (row.source_id as string | null) ?? null,
      factType: String(row.fact_type),
      content: String(row.content),
      confidence: Number(row.confidence ?? 0),
      importance: Number(row.importance ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }
}

function mapChapterResult(
  chapter: Chapter,
  query: string,
): SearchAllResultItem {
  return {
    type: "chapters",
    id: chapter.id,
    title: `第 ${chapter.chapterIndex} 章 ${chapter.title}`,
    snippet: pickSnippet(chapter.summary ?? chapter.content, query),
    score: 100 + chapter.chapterIndex / 1000,
    metadata: {
      chapterIndex: chapter.chapterIndex,
      status: chapter.status,
      wordCount: chapter.wordCount,
    },
  };
}

function mapWorldItemResult(
  item: WorldItem,
  query: string,
): SearchAllResultItem {
  return {
    type: "world_items",
    id: item.id,
    title: item.name,
    snippet: pickSnippet(item.content, query),
    score: 90 + item.importance,
    metadata: {
      itemType: item.type,
      importance: item.importance,
      tags: item.tags,
    },
  };
}

function mapCharacterResult(
  character: Character,
  query: string,
): SearchAllResultItem {
  return {
    type: "characters",
    id: character.id,
    title: character.name,
    snippet: pickSnippet(
      [
        character.role,
        character.currentState,
        character.powerLevel,
        character.location,
        character.relationshipSummary,
      ]
        .filter((part): part is string => Boolean(part))
        .join("；"),
      query,
    ),
    score: 80 + (character.status === "active" ? 4 : 0),
    metadata: {
      role: character.role,
      status: character.status,
      location: character.location,
      powerLevel: character.powerLevel,
    },
  };
}

function mapForeshadowingResult(
  item: Foreshadowing,
  query: string,
): SearchAllResultItem {
  return {
    type: "foreshadowings",
    id: item.id,
    title: item.title,
    snippet: pickSnippet(item.description, query),
    score: 70 + item.importance + (item.status === "open" ? 3 : 0),
    metadata: {
      status: item.status,
      importance: item.importance,
      expectedResolveChapter: item.expectedResolveChapter,
    },
  };
}

function mapTimelineResult(
  event: TimelineEvent,
  query: string,
): SearchAllResultItem {
  return {
    type: "timeline",
    id: event.id,
    title: event.title,
    snippet: pickSnippet(event.description, query),
    score: 60 + event.eventOrder / 1000,
    metadata: {
      eventOrder: event.eventOrder,
      location: event.location,
      chapterId: event.chapterId,
    },
  };
}

function mapCanonFactResult(
  fact: CanonFact,
  query: string,
): SearchAllResultItem {
  return {
    type: "canon_facts",
    id: fact.id,
    title: fact.factType,
    snippet: pickSnippet(fact.content, query),
    score: 85 + fact.importance + fact.confidence,
    metadata: {
      sourceType: fact.sourceType,
      sourceId: fact.sourceId,
      confidence: fact.confidence,
      importance: fact.importance,
    },
  };
}

function pickSnippet(text: string, query: string, limit = 160): string {
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }

  const term = query.trim();
  if (!term) {
    return normalized.slice(0, limit);
  }

  const index = normalized.indexOf(term);
  if (index < 0) {
    return normalized.slice(0, limit);
  }

  const start = Math.max(0, index - Math.floor(limit / 3));
  return normalized.slice(start, start + limit);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
