import type {
  Character,
  CheckContinuityInput,
  ContinuityCheckResult,
  ContinuityWarning,
  WorldItem
} from "../types/novel.js";
import { ChapterService } from "./chapterService.js";
import { CharacterService } from "./characterService.js";
import { ForeshadowingService } from "./foreshadowingService.js";
import { ProjectService } from "./projectService.js";
import { SearchService } from "./searchService.js";
import { TimelineService } from "./timelineService.js";
import { WorldService } from "./worldService.js";

const activeVerbs = ["奔跑", "大笑", "怒吼", "挥剑", "出手", "冲锋", "激战"];
const brokenRuleMarkers = ["毫无代价", "完全无视", "轻易打破", "没有限制", "瞬间学会"];

export class ContinuityService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly characterService: CharacterService,
    private readonly worldService: WorldService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly timelineService: TimelineService,
    private readonly chapterService: ChapterService,
    private readonly searchService: SearchService
  ) {}

  checkContinuity(input: CheckContinuityInput): ContinuityCheckResult {
    this.projectService.ensureProjectExists(input.projectId);

    const warnings: ContinuityWarning[] = [];
    const characters = this.pickCharacters(input);
    const worldItems = this.pickWorldItems(input);
    const foreshadowings = this.foreshadowingService.listOpenForeshadowings(
      input.projectId,
      12
    );
    const timeline = this.timelineService.getTimeline(input.projectId);

    for (const character of characters) {
      if (!mentions(input.draftContent, [character.name, ...character.aliases])) {
        continue;
      }

      if (character.status === "dead") {
        warnings.push({
          type: "character_status_conflict",
          severity: "high",
          relatedId: character.id,
          message: `角色「${character.name}」当前状态为已死亡，但草稿里仍让其直接登场。`
        });
      }

      if (
        hasAny(character.currentState, ["昏迷", "重伤", "封印", "虚弱"]) &&
        hasAny(input.draftContent, activeVerbs)
      ) {
        warnings.push({
          type: "character_state_conflict",
          severity: "medium",
          relatedId: character.id,
          message: `角色「${character.name}」当前状态偏受限，但草稿里出现了明显高强度行动。`
        });
      }

      if (character.location) {
        const conflictingLocation = worldItems.find(
          (item) =>
            item.type === "location" &&
            item.name !== character.location &&
            input.draftContent.includes(item.name)
        );

        if (conflictingLocation) {
          warnings.push({
            type: "character_location_conflict",
            severity: "medium",
            relatedId: character.id,
            message: `角色「${character.name}」记录地点为「${character.location}」，但草稿中出现了另一个地点「${conflictingLocation.name}」。`
          });
        }
      }
    }

    for (const item of worldItems) {
      if (
        ["world_rule", "power_system", "taboo"].includes(item.type) &&
        item.importance >= 4 &&
        input.draftContent.includes(item.name) &&
        hasAny(item.content, ["限制", "代价", "禁制", "不可"]) &&
        hasAny(input.draftContent, brokenRuleMarkers)
      ) {
        warnings.push({
          type: "world_rule_conflict",
          severity: "high",
          relatedId: item.id,
          message: `设定「${item.name}」自带约束，但草稿里出现了疑似无代价突破规则的描述。`
        });
      }
    }

    if (foreshadowings.length >= 6) {
      const touchedForeshadowing = foreshadowings.some((item) =>
        mentions(input.draftContent, [item.title])
      );
      if (!touchedForeshadowing) {
        warnings.push({
          type: "foreshadowing_backlog",
          severity: "low",
          message: `当前仍有 ${foreshadowings.length} 条未回收伏笔，本章草稿暂未显式触达其中任何一条。`
        });
      }
    }

    if (timeline.length > 0 && hasAny(input.draftContent, ["总而言之", "总结一下"])) {
      warnings.push({
        type: "summary_instead_of_plot",
        severity: "medium",
        message: "草稿出现明显总结式表达，可能在用概述替代剧情推进。"
      });
    }

    if (input.chapterIndex !== undefined) {
      const previousChapter = this.chapterService.getChapterByIndex(
        input.projectId,
        input.chapterIndex - 1
      );

      if (
        previousChapter &&
        previousChapter.hook &&
        !input.draftContent.includes(previousChapter.hook.slice(0, 10))
      ) {
        warnings.push({
          type: "hook_carryover_risk",
          severity: "low",
          relatedId: previousChapter.id,
          message: "上一章钩子没有明显在新草稿中得到承接，建议人工再核一遍衔接。"
        });
      }
    }

    return {
      ok: warnings.length === 0,
      warnings
    };
  }

  private pickCharacters(input: CheckContinuityInput): Character[] {
    if (input.relatedCharacterIds?.length) {
      return this.searchService.resolveCharacters(input.projectId, input.relatedCharacterIds);
    }

    return this.characterService.listCharacters(input.projectId).slice(0, 12);
  }

  private pickWorldItems(input: CheckContinuityInput): WorldItem[] {
    if (input.relatedWorldItemIds?.length) {
      return this.searchService.resolveWorldItems(input.projectId, input.relatedWorldItemIds);
    }

    return this.worldService.listWorldItems(input.projectId).slice(0, 20);
  }
}

function hasAny(text: string | null | undefined, patterns: string[]): boolean {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => text.includes(pattern));
}

function mentions(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => alias.length > 0 && text.includes(alias));
}
