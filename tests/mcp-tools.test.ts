import { afterEach, describe, expect, it } from "vitest";
import type {
  Chapter,
  ContinuityCheckResult,
  ExportedProjectData,
  Foreshadowing,
  ImportProjectResult,
  NextChapterContext,
  ChapterOutline,
  CharacterRelationship,
  PlanNextChapterResult,
  Project,
  Volume,
  WorldItem,
  Character,
} from "../src/types/novel.js";
import {
  callToolData,
  createMcpTestHarness,
  type McpTestHarness,
} from "./helpers.js";

const harnesses: McpTestHarness[] = [];

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    await harness?.close();
  }
});

describe("MCP tools", () => {
  it("runs the core novel workflow through MCP tool calls", async () => {
    const { client } = await trackHarness();
    const toolList = await client.listTools();

    expect(toolList.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "create_project",
        "add_world_item",
        "add_character",
        "create_volume",
        "create_chapter_outline",
        "save_chapter",
        "add_foreshadowing",
        "build_next_chapter_context",
        "check_continuity",
        "search_chapters",
      ]),
    );

    const project = await callToolData<Project>(client, "create_project", {
      name: "星渊回声",
      genre: "玄幻",
      targetWords: 8_000_000,
    });
    const worldItem = await callToolData<WorldItem>(client, "add_world_item", {
      projectId: project.id,
      type: "world_rule",
      name: "灵契铁律",
      content: "灵契发动必须付出代价，不可无视。",
      importance: 5,
      tags: ["力量体系"],
    });
    const character = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "顾昭",
      aliases: ["小顾"],
      role: "主角",
      currentState: "初入白鹿书院",
      location: "白鹿书院",
    });
    const volume = await callToolData<Volume>(client, "create_volume", {
      projectId: project.id,
      volumeIndex: 1,
      title: "书院风暴",
      goal: "找到风铃旧名背后的真相",
      conflict: "长老会试图封锁禁地",
    });

    await callToolData<Record<string, unknown>>(
      client,
      "create_chapter_outline",
      {
        projectId: project.id,
        volumeId: volume.id,
        chapterIndex: 2,
        title: "风暴前夜",
        goal: "逼近书院禁地",
        conflict: "必须赶在长老会封门前拿到线索",
        keyEvents: "顾昭调查风铃\n长老会封锁禁地",
        requiredCharacters: [character.id],
        endingHook: "风铃喊出了顾昭母亲的名字。",
      },
    );
    const chapter = await callToolData<Chapter>(client, "save_chapter", {
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "入院",
      content:
        "顾昭进入白鹿书院后发现禁地的风铃每到子夜都会自鸣，像在召唤某个旧名字。",
      summary: "顾昭入院并发现禁地风铃异动。",
      hook: "禁地风铃在子夜喊出了一个旧名字。",
      involvedCharacters: [character.id],
      involvedWorldItems: [worldItem.id],
    });
    const foreshadowing = await callToolData<Foreshadowing>(
      client,
      "add_foreshadowing",
      {
        projectId: project.id,
        title: "风铃旧名",
        description: "风铃在呼唤一个被抹掉的名字。",
        introducedChapterId: chapter.id,
        importance: 4,
        relatedCharacters: [character.id],
      },
    );
    const context = await callToolData<NextChapterContext>(
      client,
      "build_next_chapter_context",
      {
        projectId: project.id,
        chapterIndex: 2,
        volumeId: volume.id,
        focus: "禁地风铃",
      },
    );
    const continuity = await callToolData<ContinuityCheckResult>(
      client,
      "check_continuity",
      {
        projectId: project.id,
        chapterIndex: 2,
        relatedWorldItemIds: [worldItem.id],
        draftContent:
          "顾昭完全无视灵契铁律，毫无代价地启动风铃，准备闯进白鹿书院禁地。",
      },
    );
    const matches = await callToolData<Chapter[]>(client, "search_chapters", {
      projectId: project.id,
      query: "风铃",
      limit: 5,
    });

    expect(chapter.wordCount).toBeGreaterThan(10);
    expect(foreshadowing.status).toBe("open");
    expect(
      context.relevantCharacters.some((item) => item.name === "顾昭"),
    ).toBe(true);
    expect(
      context.openForeshadowings.some((item) => item.title === "风铃旧名"),
    ).toBe(true);
    expect(continuity.ok).toBe(false);
    expect(continuity.warnings.map((warning) => warning.type)).toContain(
      "world_rule_conflict",
    );
    expect(matches.map((item) => item.id)).toContain(chapter.id);
  });

  it("exports, imports, plans, and builds post-chapter prompts through MCP tools", async () => {
    const { client } = await trackHarness();
    const project = await callToolData<Project>(client, "create_project", {
      name: "烬海长明",
    });
    const character = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "沈烬",
      role: "主角",
      location: "听潮城",
    });
    const volume = await callToolData<Volume>(client, "create_volume", {
      projectId: project.id,
      volumeIndex: 1,
      title: "黑雨入城",
      goal: "查清黑雨源头",
    });

    await callToolData<Chapter>(client, "save_chapter", {
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "黑雨将至",
      content: "沈烬踏入听潮城，黑雨从云层垂落，古碑在城心发出第一声裂响。",
      summary: "沈烬入城，黑雨和古碑同时异动。",
      hook: "古碑裂缝里传出第二个人的心跳。",
      involvedCharacters: [character.id],
    });

    const exported = await callToolData<ExportedProjectData>(
      client,
      "export_project",
      {
        projectId: project.id,
      },
    );
    const imported = await callToolData<ImportProjectResult>(
      client,
      "import_project",
      {
        data: exported,
      },
    );
    const importedMatches = await callToolData<Chapter[]>(
      client,
      "search_chapters",
      {
        projectId: imported.project.id,
        query: "古碑",
        limit: 5,
      },
    );
    const plan = await callToolData<PlanNextChapterResult>(
      client,
      "plan_next_chapter",
      {
        projectId: imported.project.id,
        chapterIndex: 2,
        focus: "古碑裂缝",
      },
    );
    const postPrompt = await callToolData<string>(
      client,
      "build_post_chapter_update_prompt",
      {
        projectId: imported.project.id,
        chapterIndex: 1,
      },
    );

    expect(exported.project.id).toBe(project.id);
    expect(imported.project.id).not.toBe(project.id);
    expect(imported.project.currentWords).toBeGreaterThan(10);
    expect(importedMatches).toHaveLength(1);
    expect(plan.outlineSuggestion.keyEvents.length).toBeGreaterThan(0);
    expect(plan.instruction).toContain("古碑裂缝");
    expect(postPrompt).toContain("JSON Schema");
    expect(postPrompt).toContain("章节正文");
  });

  it("clears nullable update fields through MCP tool calls", async () => {
    const { client } = await trackHarness();
    const project = await callToolData<Project>(client, "create_project", {
      name: "清空字段",
      genre: "玄幻",
      platform: "番茄",
      targetWords: 8_000_000,
      style: "快节奏",
    });
    const characterA = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "甲",
    });
    const characterB = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "乙",
    });
    const relationship = await callToolData<CharacterRelationship>(
      client,
      "add_character_relationship",
      {
        projectId: project.id,
        characterAId: characterA.id,
        characterBId: characterB.id,
        relationshipType: "盟友",
        description: "临时同盟",
        currentState: "互相试探",
        tensionLevel: 7,
      },
    );
    const volume = await callToolData<Volume>(client, "create_volume", {
      projectId: project.id,
      volumeIndex: 1,
      title: "第一卷",
      goal: "攻入旧城",
      conflict: "旧盟反叛",
      summary: "旧城线",
    });
    const outline = await callToolData<ChapterOutline>(
      client,
      "create_chapter_outline",
      {
        projectId: project.id,
        volumeId: volume.id,
        chapterIndex: 1,
        title: "旧城门",
        goal: "进入旧城",
        conflict: "守门人阻拦",
        keyEvents: "破门",
        endingHook: "门后有人",
      },
    );

    const clearedProject = await callToolData<Project>(
      client,
      "update_project",
      {
        projectId: project.id,
        genre: null,
        platform: null,
        targetWords: null,
        style: null,
      },
    );
    const clearedVolume = await callToolData<Volume>(client, "update_volume", {
      projectId: project.id,
      volumeId: volume.id,
      goal: null,
      conflict: null,
      summary: null,
    });
    const clearedOutline = await callToolData<ChapterOutline>(
      client,
      "update_chapter_outline",
      {
        projectId: project.id,
        outlineId: outline.id,
        goal: null,
        conflict: null,
        keyEvents: null,
        endingHook: null,
      },
    );
    const clearedRelationship = await callToolData<CharacterRelationship>(
      client,
      "update_character_relationship",
      {
        projectId: project.id,
        relationshipId: relationship.id,
        description: null,
        currentState: null,
        tensionLevel: null,
      },
    );

    expect(clearedProject.genre).toBeNull();
    expect(clearedProject.platform).toBeNull();
    expect(clearedProject.targetWords).toBeNull();
    expect(clearedProject.style).toBeNull();
    expect(clearedVolume.goal).toBeNull();
    expect(clearedVolume.conflict).toBeNull();
    expect(clearedVolume.summary).toBeNull();
    expect(clearedOutline.goal).toBeNull();
    expect(clearedOutline.conflict).toBeNull();
    expect(clearedOutline.keyEvents).toBeNull();
    expect(clearedOutline.endingHook).toBeNull();
    expect(clearedRelationship.description).toBeNull();
    expect(clearedRelationship.currentState).toBeNull();
    expect(clearedRelationship.tensionLevel).toBeNull();
  });
});

async function trackHarness(): Promise<McpTestHarness> {
  const harness = await createMcpTestHarness();
  harnesses.push(harness);
  return harness;
}
