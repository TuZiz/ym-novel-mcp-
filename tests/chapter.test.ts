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

describe("chapter service", () => {
  it("saves chapters and updates recent chapter/project word counts", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "夜行碑"
    });
    const volume = app.services.outlineService.createVolume({
      projectId: project.id,
      volumeIndex: 1,
      title: "第一卷 黑雨入城"
    });

    app.services.chapterService.saveChapter({
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 1,
      title: "黑雨将至",
      content: "林夜踏入城门，黑雨从云层垂落，街上的灯火在水雾里摇晃。",
      summary: "林夜入城，风暴前夕。",
      hook: "城中心的古碑发出第一声裂响。"
    });

    const secondChapter = app.services.chapterService.saveChapter({
      projectId: project.id,
      volumeId: volume.id,
      chapterIndex: 2,
      title: "古碑裂响",
      content: "古碑裂响之后，整座城都像被惊醒，林夜被迫卷入第一场追杀。",
      summary: "古碑异动，追杀爆发。",
      hook: "裂缝里伸出的黑手抓住了他的刀。",
      status: "draft"
    });

    const recent = app.services.chapterService.getRecentChapters({
      projectId: project.id,
      beforeChapterIndex: 3,
      limit: 2,
      includeContent: false
    });
    const refreshedProject = app.services.projectService.getProject(project.id);

    expect(secondChapter.wordCount).toBeGreaterThan(10);
    expect(recent.map((chapter) => chapter.chapterIndex)).toEqual([2, 1]);
    expect(refreshedProject.currentWords).toBeGreaterThan(20);
  });
});
