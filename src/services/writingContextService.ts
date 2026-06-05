import type {
  BuildNextChapterContextInput,
  Chapter,
  Character,
  Foreshadowing,
  NextChapterContext,
  WorldItem,
} from "../types/novel.js";
import { compactText } from "../utils/text.js";
import { ChapterService } from "./chapterService.js";
import { CharacterService } from "./characterService.js";
import { ForeshadowingService } from "./foreshadowingService.js";
import { OutlineService } from "./outlineService.js";
import { ProjectService } from "./projectService.js";
import { SearchService } from "./searchService.js";
import { TimelineService } from "./timelineService.js";
import { WorldService } from "./worldService.js";

const maxContextChapterContentChars = 2400;
const omittedChapterContentMarker = "\n\n[...中间正文已为上下文省略...]\n\n";

export class WritingContextService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly outlineService: OutlineService,
    private readonly chapterService: ChapterService,
    private readonly characterService: CharacterService,
    private readonly worldService: WorldService,
    private readonly foreshadowingService: ForeshadowingService,
    private readonly timelineService: TimelineService,
    private readonly searchService: SearchService,
  ) {}

  buildNextChapterContext(
    input: BuildNextChapterContextInput,
  ): NextChapterContext {
    const project = this.projectService.getProject(input.projectId);
    const currentVolume = input.volumeId
      ? this.outlineService.getVolume(input.projectId, input.volumeId)
      : this.outlineService.getCurrentVolume(input.projectId);
    const chapterOutline = this.outlineService.getChapterOutline(
      input.projectId,
      input.chapterIndex,
    );
    const recentChapters = this.chapterService
      .getRecentChapters({
        projectId: input.projectId,
        beforeChapterIndex: input.chapterIndex,
        limit: input.recentChapterLimit ?? 5,
        includeContent: true,
      })
      .reverse()
      .map(compactChapterForContext);
    const openForeshadowings = this.foreshadowingService.listOpenForeshadowings(
      input.projectId,
      10,
    );
    const overdueForeshadowings = this.buildOverdueForeshadowings(
      input.projectId,
      input.chapterIndex,
    );
    const recentTimelineEvents = this.timelineService
      .getTimeline(input.projectId)
      .slice(-12);
    const timeline = recentTimelineEvents;
    const canonFacts = this.projectService.listCanonFacts(input.projectId, 24);
    const writingRules = this.projectService.listWritingRules(input.projectId);

    const relevantCharacters = this.buildRelevantCharacters(
      input.projectId,
      chapterOutline?.requiredCharacters ?? [],
      recentChapters.flatMap((chapter) => chapter.involvedCharacters),
      input.focus,
    );
    const relevantWorldItems = this.buildRelevantWorldItems(
      input.projectId,
      recentChapters.flatMap((chapter) => chapter.involvedWorldItems),
      chapterOutline?.title,
      chapterOutline?.goal,
      input.focus,
    );
    const searchHints = this.buildSearchHints(
      chapterOutline?.title,
      chapterOutline?.goal,
      chapterOutline?.conflict,
      input.focus,
      recentChapters.at(-1)?.hook,
      overdueForeshadowings,
    );

    const instruction = [
      `你正在续写长篇小说《${project.name}》的第 ${input.chapterIndex} 章。`,
      "优先承接上一章 hook，不要跳过上一章危机。",
      "必须承接上一章结尾，不能跳过关键冲突。",
      "必须遵守既有世界观、人物状态、战力体系和写作规则。",
      "必须保持人物性格一致，不允许为了推进剧情硬改人设。",
      "不要让角色瞬移，不要随便突破战力。",
      "未回收伏笔要持续推进，超期伏笔必须优先处理或明确延后理由。",
      "本章需要推进当前冲突，并在结尾保留明确钩子。",
      "不要用总结代替剧情，不要输出解释，只输出可直接写正文的中文创作提示。",
      chapterOutline
        ? `当前章节大纲：标题《${chapterOutline.title}》；目标=${chapterOutline.goal ?? "未填写"}；冲突=${chapterOutline.conflict ?? "未填写"}。`
        : "当前章节尚无大纲，请优先根据最近剧情和未回收伏笔稳妥续写。",
      currentVolume
        ? `当前卷：第 ${currentVolume.volumeIndex} 卷《${currentVolume.title}》。`
        : "当前卷信息暂缺。",
      input.focus ? `本章聚焦：${input.focus}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    return {
      project,
      currentVolume,
      chapterOutline,
      recentChapters,
      relevantCharacters,
      relevantWorldItems,
      openForeshadowings,
      overdueForeshadowings,
      timeline,
      recentTimelineEvents,
      canonFacts,
      writingRules,
      searchHints,
      instruction,
    };
  }

  private buildRelevantCharacters(
    projectId: string,
    outlineRefs: string[],
    recentRefs: string[],
    focus?: string,
  ): Character[] {
    const explicit = this.searchService.resolveCharacters(projectId, [
      ...outlineRefs,
      ...recentRefs,
    ]);

    if (explicit.length >= 6) {
      return explicit.slice(0, 10);
    }

    const searched = focus
      ? this.characterService.searchCharacters(projectId, focus, 6)
      : this.characterService.listCharacters(projectId).slice(0, 6);

    return dedupeById([...explicit, ...searched]).slice(0, 10);
  }

  private buildRelevantWorldItems(
    projectId: string,
    recentRefs: string[],
    title?: string | null,
    goal?: string | null,
    focus?: string,
  ): WorldItem[] {
    const explicit = this.searchService.resolveWorldItems(
      projectId,
      recentRefs,
    );
    const searchQuery = compactText(title ?? null, goal ?? null, focus ?? null);
    const searched = searchQuery
      ? this.worldService.searchWorldItems(projectId, searchQuery, undefined, 6)
      : this.worldService.listWorldItems(projectId).slice(0, 6);

    return dedupeById([...explicit, ...searched]).slice(0, 10);
  }

  private buildOverdueForeshadowings(
    projectId: string,
    chapterIndex: number,
  ): Foreshadowing[] {
    return this.foreshadowingService
      .listForeshadowings(projectId)
      .filter(
        (item) =>
          ["open", "partially_resolved"].includes(item.status) &&
          item.expectedResolveChapter !== null &&
          item.expectedResolveChapter < chapterIndex,
      )
      .slice(0, 12);
  }

  private buildSearchHints(
    title: string | null | undefined,
    goal: string | null | undefined,
    conflict: string | null | undefined,
    focus: string | undefined,
    previousHook: string | null | undefined,
    overdueForeshadowings: Foreshadowing[],
  ): string[] {
    return [
      title,
      goal,
      conflict,
      focus,
      previousHook,
      ...overdueForeshadowings.map((item) => item.title),
    ]
      .map((hint) => hint?.trim())
      .filter((hint): hint is string => Boolean(hint))
      .slice(0, 12);
  }
}

function compactChapterForContext(chapter: Chapter): Chapter {
  if (chapter.content.length <= maxContextChapterContentChars) {
    return chapter;
  }

  const sideLength = Math.floor(
    (maxContextChapterContentChars - omittedChapterContentMarker.length) / 2,
  );
  const start = chapter.content.slice(0, sideLength);
  const end = chapter.content.slice(chapter.content.length - sideLength);

  return {
    ...chapter,
    content: `${start}${omittedChapterContentMarker}${end}`,
  };
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
