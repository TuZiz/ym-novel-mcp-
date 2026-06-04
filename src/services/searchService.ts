import type {
  Chapter,
  Character,
  Foreshadowing,
  WorldItem
} from "../types/novel.js";
import { ChapterService } from "./chapterService.js";
import { CharacterService } from "./characterService.js";
import { ForeshadowingService } from "./foreshadowingService.js";
import { WorldService } from "./worldService.js";

export class SearchService {
  constructor(
    private readonly characterService: CharacterService,
    private readonly worldService: WorldService,
    private readonly chapterService: ChapterService,
    private readonly foreshadowingService: ForeshadowingService
  ) {}

  searchEverything(projectId: string, query: string, limit = 5): {
    characters: Character[];
    worldItems: WorldItem[];
    chapters: Chapter[];
    foreshadowings: Foreshadowing[];
  } {
    return {
      characters: this.characterService.searchCharacters(projectId, query, limit),
      worldItems: this.worldService.searchWorldItems(projectId, query, undefined, limit),
      chapters: this.chapterService.searchChapters(projectId, query, limit),
      foreshadowings: this.foreshadowingService.searchForeshadowings(
        projectId,
        query,
        limit
      )
    };
  }

  resolveCharacters(projectId: string, refs: string[]): Character[] {
    const exactMap = new Map(
      this.characterService.listCharacters(projectId).flatMap((character) => [
        [character.id, character],
        [character.name, character],
        ...character.aliases.map((alias) => [alias, character] as const)
      ])
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
        [item.name, item]
      ])
    );

    const resolved = refs
      .map((ref) => exactMap.get(ref))
      .filter((item): item is WorldItem => Boolean(item));

    return dedupeById(resolved);
  }

  resolveForeshadowings(projectId: string, refs: string[]): Foreshadowing[] {
    const exactMap = new Map(
      this.foreshadowingService.listForeshadowings(projectId).flatMap((item) => [
        [item.id, item],
        [item.title, item]
      ])
    );

    const resolved = refs
      .map((ref) => exactMap.get(ref))
      .filter((item): item is Foreshadowing => Boolean(item));

    return dedupeById(resolved);
  }
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
