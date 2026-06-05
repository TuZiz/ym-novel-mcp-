import { afterEach, describe, expect, it } from "vitest";
import type {
  ApplyPostChapterUpdateResult,
  NextChapterContext,
  SearchAllResult,
} from "../src/types/novel.js";
import type { AppInstance } from "../src/server.js";
import { createTestApp } from "./helpers.js";

const apps: AppInstance[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    await app?.close();
  }
});

describe("phase three novel pipeline", () => {
  it("applies post-chapter updates across chapter, character, world, foreshadowing, timeline, and canon", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "归墟长明",
    });
    const character = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "沈烬",
      currentState: "初入听潮城",
      powerLevel: "炼气一层",
      location: "听潮城",
    });
    const chapter = app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 3,
      title: "黑雨回声",
      content: "沈烬在听潮城听见黑雨深处传来古碑回声。",
      summary: "旧摘要",
      hook: "旧钩子",
    });
    const foreshadowing = app.services.foreshadowingService.addForeshadowing({
      projectId: project.id,
      title: "黑雨源头",
      description: "黑雨来自城外归墟。",
      expectedResolveChapter: 3,
      importance: 4,
    });

    const result = app.services.chapterPipelineService.applyPostChapterUpdate({
      projectId: project.id,
      chapterIndex: 3,
      update: {
        summary: "沈烬确认黑雨与古碑回声有关。",
        hook: "古碑回声里出现第二个心跳。",
        characterUpdates: [
          {
            name: "沈烬",
            currentState: "听见古碑心跳",
            powerLevel: "炼气二层",
            location: "古碑广场",
            relationshipSummary: "开始怀疑城主府。",
          },
          {
            name: "不存在的人",
            currentState: "不会被创建",
          },
        ],
        newWorldItems: [
          {
            type: "artifact",
            name: "古碑",
            content: "古碑会记录黑雨中的心跳。",
            importance: 5,
            tags: ["黑雨", "古碑"],
          },
        ],
        newForeshadowings: [
          {
            title: "第二个心跳",
            description: "古碑裂缝中出现不属于沈烬的心跳。",
            expectedResolveChapter: 8,
            importance: 4,
            relatedCharacters: [character.id],
          },
        ],
        resolvedForeshadowings: [
          {
            foreshadowingId: foreshadowing.id,
            notes: "确认黑雨源头与古碑有关。",
          },
        ],
        timelineEvents: [
          {
            title: "古碑回声",
            description: "沈烬在古碑广场听见第二个心跳。",
            involvedCharacters: [character.id],
            location: "古碑广场",
            impact: "黑雨主线推进",
          },
        ],
        canonFacts: [
          {
            factType: "artifact_rule",
            content: "古碑会记录黑雨中的心跳。",
            confidence: 0.93,
            importance: 5,
          },
        ],
      },
    });

    const updatedChapter = app.services.chapterService.getChapter(
      project.id,
      chapter.id,
    );
    const updatedCharacter = app.services.characterService.getCharacter(
      project.id,
      character.id,
    );

    expectApplyResult(result);
    expect(updatedChapter.summary).toBe("沈烬确认黑雨与古碑回声有关。");
    expect(updatedChapter.hook).toBe("古碑回声里出现第二个心跳。");
    expect(updatedCharacter.currentState).toBe("听见古碑心跳");
    expect(updatedCharacter.powerLevel).toBe("炼气二层");
    expect(updatedCharacter.relationshipSummary).toBe("开始怀疑城主府。");
    expect(result.addedWorldItems[0]?.name).toBe("古碑");
    expect(result.addedForeshadowings[0]?.title).toBe("第二个心跳");
    expect(result.resolvedForeshadowings[0]?.status).toBe("resolved");
    expect(result.addedTimelineEvents[0]?.eventOrder).toBe(0);
    expect(result.addedCanonFacts[0]?.content).toBe("古碑会记录黑雨中的心跳。");
    expect(result.warnings.map((warning) => warning.type)).toContain(
      "character_name_not_found",
    );
  });

  it("searches across all supported sources", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "聚合搜索",
    });
    const character = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "顾昭",
      currentState: "追查星钥",
    });
    const worldItem = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "artifact",
      name: "星钥",
      content: "星钥能打开白鹿书院禁地。",
      importance: 5,
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "星钥初鸣",
      content: "顾昭发现星钥在禁地门前发光。",
      summary: "星钥第一次出现。",
      involvedCharacters: [character.id],
      involvedWorldItems: [worldItem.id],
    });
    app.services.foreshadowingService.addForeshadowing({
      projectId: project.id,
      title: "星钥真名",
      description: "星钥还有另一个被抹掉的真名。",
    });
    app.services.timelineService.addTimelineEvent({
      projectId: project.id,
      eventOrder: 1,
      title: "星钥发光",
      description: "星钥在禁地门前第一次发光。",
    });
    app.services.chapterPipelineService.applyPostChapterUpdate({
      projectId: project.id,
      chapterIndex: 1,
      update: {
        canonFacts: [
          {
            factType: "artifact_rule",
            content: "星钥能打开白鹿书院禁地。",
            importance: 5,
          },
        ],
      },
    });

    const result = app.services.searchService.searchAll({
      projectId: project.id,
      query: "星钥",
      limit: 10,
    });

    expectSearchResult(result);
    expect(result.results.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "chapters",
        "characters",
        "world_items",
        "foreshadowings",
        "timeline",
        "canon_facts",
      ]),
    );
  });

  it("creates, lists, and reads project snapshots", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "快照测试",
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "第一章",
      content: "主角完成第一次选择。",
      summary: "第一次选择。",
    });

    const snapshot = app.services.projectSnapshotService.createSnapshot({
      projectId: project.id,
      label: "第一章后",
      notes: "完成第一章落库。",
    });
    const snapshots = app.services.projectSnapshotService.listSnapshots({
      projectId: project.id,
    });
    const detail = app.services.projectSnapshotService.getSnapshot(snapshot.id);

    expect(snapshot.projectId).toBe(project.id);
    expect(snapshots.map((item) => item.id)).toContain(snapshot.id);
    expect(detail.content.project.id).toBe(project.id);
    expect(detail.content.chapters).toHaveLength(1);
  });

  it("reports new continuity warnings and enriches next-chapter context", () => {
    const app = createTrackedApp();
    const project = app.services.projectService.createProject({
      name: "连续性增强",
    });
    const character = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "林夜",
      currentState: "重伤",
      powerLevel: "炼气一层",
      location: "听潮城",
    });
    const otherLocation = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "锁渊塔",
      content: "城外禁塔。",
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "黑门",
      content: "黑门开始震动。",
      summary: "黑门初震。",
      hook: "黑门开始震动。",
    });
    app.services.foreshadowingService.addForeshadowing({
      projectId: project.id,
      title: "黑门之谜",
      description: "黑门为何震动仍未解释。",
      expectedResolveChapter: 1,
      importance: 5,
    });
    app.services.timelineService.addTimelineEvent({
      projectId: project.id,
      eventOrder: 1,
      title: "黑门震动",
      description: "黑门第一次震动。",
      location: "听潮城",
    });
    app.services.chapterPipelineService.applyPostChapterUpdate({
      projectId: project.id,
      chapterIndex: 1,
      update: {
        canonFacts: [
          {
            factType: "world_rule",
            content: "黑门不能被凡火打开",
            importance: 5,
          },
        ],
      },
    });

    const continuity = app.services.continuityService.checkContinuity({
      projectId: project.id,
      chapterIndex: 3,
      relatedCharacterIds: [character.id],
      relatedWorldItemIds: [otherLocation.id],
      draftContent:
        "林夜在锁渊塔秒杀守卫，突破数阶后宣布黑门不能被凡火打开是假的。",
    });
    const context = app.services.writingContextService.buildNextChapterContext({
      projectId: project.id,
      chapterIndex: 3,
      focus: "黑门",
    });

    expect(continuity.warnings.map((warning) => warning.type)).toEqual(
      expect.arrayContaining([
        "power_level_jump_risk",
        "location_jump_risk",
        "foreshadowing_overdue",
        "canon_fact_conflict",
      ]),
    );
    expectContext(context);
    expect(
      context.canonFacts.some((fact) => fact.content.includes("黑门")),
    ).toBe(true);
    expect(context.overdueForeshadowings.map((item) => item.title)).toContain(
      "黑门之谜",
    );
    expect(context.recentTimelineEvents.map((item) => item.title)).toContain(
      "黑门震动",
    );
    expect(context.searchHints).toContain("黑门");
  });
});

function createTrackedApp(): AppInstance {
  const app = createTestApp();
  apps.push(app);
  return app;
}

function expectApplyResult(result: ApplyPostChapterUpdateResult): void {
  expect(result.ok).toBe(true);
  expect(result.addedWorldItems).toHaveLength(1);
  expect(result.addedForeshadowings).toHaveLength(1);
  expect(result.resolvedForeshadowings).toHaveLength(1);
  expect(result.addedTimelineEvents).toHaveLength(1);
  expect(result.addedCanonFacts).toHaveLength(1);
}

function expectSearchResult(result: SearchAllResult): void {
  expect(result.query).toBe("星钥");
  expect(result.results.length).toBeGreaterThanOrEqual(6);
  expect(
    result.results.every((item) => item.id && item.title && item.snippet),
  ).toBe(true);
}

function expectContext(context: NextChapterContext): void {
  expect(context.canonFacts.length).toBeGreaterThan(0);
  expect(context.overdueForeshadowings.length).toBeGreaterThan(0);
  expect(context.recentTimelineEvents.length).toBeGreaterThan(0);
  expect(context.searchHints.length).toBeGreaterThan(0);
  expect(context.instruction).toContain("不要让角色瞬移");
  expect(context.instruction).toContain("未回收伏笔");
}
