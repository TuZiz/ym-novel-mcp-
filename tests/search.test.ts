import { afterEach, describe, expect, it } from "vitest";
import type { AppInstance } from "../src/server.js";
import { createTestApp } from "./helpers.js";

const apps: AppInstance[] = [];

afterEach(() => {
  while (apps.length > 0) {
    const app = apps.pop();
    app?.database.close();
  }
});

describe("search and context services", () => {
  it("searches chapters and builds next chapter context", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "万象火种"
    });
    const hero = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "顾昭",
      aliases: ["小顾"],
      role: "主角",
      location: "白鹿书院"
    });
    const academy = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "白鹿书院",
      content: "帝国最古老的修行学府。",
      importance: 5
    });
    const volume = app.services.outlineService.createVolume({
      projectId: project.id,
      volumeIndex: 1,
      title: "书院风暴"
    });
    app.services.outlineService.createChapterOutline({
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 2,
      title: "风暴前夜",
      goal: "逼近书院禁地",
      conflict: "必须在长老赶来前拿到线索",
      requiredCharacters: [hero.id]
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "入院",
      content:
        "顾昭进入白鹿书院后发现禁地的风铃每到子夜都会自鸣，像在召唤某个旧名字。",
      summary: "顾昭入院并发现禁地风铃异动。",
      involvedCharacters: [hero.id],
      involvedWorldItems: [academy.id]
    });
    app.services.foreshadowingService.addForeshadowing({
      projectId: project.id,
      title: "风铃旧名",
      description: "风铃在呼唤一个被抹掉的名字。",
      importance: 4
    });

    const matches = app.services.chapterService.searchChapters(project.id, "风铃", 5);
    const context = app.services.writingContextService.buildNextChapterContext({
      projectId: project.id,
      chapterIndex: 2,
      volumeId: volume.id
    });

    expect(matches).toHaveLength(1);
    expect(context.relevantCharacters[0]?.name).toBe("顾昭");
    expect(context.relevantWorldItems.some((item) => item.name === "白鹿书院")).toBe(
      true
    );
    expect(context.openForeshadowings).toHaveLength(1);
  });

  it("adds and resolves foreshadowings", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "裂天观海"
    });
    const chapter = app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "观海",
      content: "主角在悬崖边看到海面裂开一条细线。",
      summary: "海面出现异常裂缝。"
    });
    const foreshadowing = app.services.foreshadowingService.addForeshadowing({
      projectId: project.id,
      title: "海裂之谜",
      description: "海面裂缝来源不明。",
      introducedChapterId: chapter.id
    });

    const resolved = app.services.foreshadowingService.resolveForeshadowing({
      projectId: project.id,
      foreshadowingId: foreshadowing.id,
      resolvedChapterId: chapter.id
    });

    expect(resolved.status).toBe("resolved");
  });
});
