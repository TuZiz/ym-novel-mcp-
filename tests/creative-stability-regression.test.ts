import { afterEach, describe, expect, it } from "vitest";
import type { AppInstance } from "../src/server.js";
import type { Chapter, Character, Project } from "../src/types/novel.js";
import {
  callToolData,
  createMcpTestHarness,
  createTestApp,
  type McpTestHarness,
} from "./helpers.js";

const apps: AppInstance[] = [];
const harnesses: McpTestHarness[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    apps.pop()?.database.close();
  }
  while (harnesses.length > 0) {
    await harnesses.pop()?.close();
  }
});

describe("creative stability regressions", () => {
  it("save_chapter stores short chapters without quality gate", async () => {
    const { client } = await trackHarness();
    const project = await createQualityProject();

    const chapter = await callToolData<Chapter>(client, "save_chapter", {
      projectId: project.id,
      chapterIndex: 1,
      title: "短章",
      content: shortChapterContent,
    });

    expect(chapter.wordCount).toBeLessThan(100);
  });

  it("save_chapter_with_quality_gate blocks too_short", async () => {
    const { client } = await trackHarness();
    const project = await createQualityProject();

    await expect(
      callToolData<Chapter>(client, "save_chapter_with_quality_gate", {
        projectId: project.id,
        chapterIndex: 1,
        title: "短章",
        content: shortChapterContent,
      }),
    ).rejects.toThrow(/too_short/);
  });

  it("allowShortReason bypasses too_short", async () => {
    const { client } = await trackHarness();
    const project = await createQualityProject();

    const chapter = await callToolData<Chapter>(
      client,
      "save_chapter_with_quality_gate",
      {
        projectId: project.id,
        chapterIndex: 1,
        title: "短章",
        content: shortChapterContent,
        allowShortReason: "序章刻意短章。",
      },
    );

    expect(chapter.wordCount).toBeLessThan(100);
  });

  it("allowQualityOverrideReason does not bypass too_short", async () => {
    const { client } = await trackHarness();
    const project = await createQualityProject();

    await expect(
      callToolData<Chapter>(client, "save_chapter_with_quality_gate", {
        projectId: project.id,
        chapterIndex: 1,
        title: "短章",
        content: shortChapterContent,
        allowQualityOverrideReason: "质量覆盖理由不能绕过短章。",
      }),
    ).rejects.toThrow(/too_short/);
  });

  it("blocks summary_over_plot without allowQualityOverrideReason", async () => {
    const { client } = await trackHarness();
    const project = await createProject();

    await expect(
      callToolData<Chapter>(client, "save_chapter_with_quality_gate", {
        projectId: project.id,
        chapterIndex: 1,
        title: "总结化章节",
        content: summaryOverPlotContent,
      }),
    ).rejects.toThrow(/summary_over_plot/);
  });

  it("allows summary_over_plot with allowQualityOverrideReason", async () => {
    const { client } = await trackHarness();
    const project = await createProject();

    const chapter = await callToolData<Chapter>(
      client,
      "save_chapter_with_quality_gate",
      {
        projectId: project.id,
        chapterIndex: 1,
        title: "总结化章节",
        content: summaryOverPlotContent,
        allowQualityOverrideReason: "人工确认这是过场压缩章节。",
      },
    );

    expect(chapter.title).toBe("总结化章节");
  });

  it("upsertNameBank keeps old pools when updating style", () => {
    const app = trackApp();
    const project = app.services.projectService.createProject({
      name: "Name Bank",
    });
    const initial = app.services.nameService.upsertNameBank({
      projectId: project.id,
      era: "现代",
      region: "华东",
      style: "plain",
      surnamePool: ["陈", "李"],
      givenNamePool: ["明", "安"],
    });

    const restyled = app.services.nameService.upsertNameBank({
      projectId: project.id,
      era: "现代",
      region: "华东",
      style: "polished",
    });

    expect(restyled.style).toBe("polished");
    expect(restyled.surnamePool).toEqual(initial.surnamePool);
    expect(restyled.givenNamePool).toEqual(initial.givenNamePool);
  });

  it("reviewCharacterName does not recurse forever with fully banned pools", () => {
    const app = trackApp();
    const project = app.services.projectService.createProject({
      name: "Blocked Names",
    });
    app.services.nameService.upsertNameBank({
      projectId: project.id,
      style: "blocked",
      surnamePool: ["叶"],
      givenNamePool: ["辰"],
      bannedTokens: ["叶", "辰"],
      bannedFullNames: ["叶辰"],
    });

    const review = app.services.nameService.reviewCharacterName({
      projectId: project.id,
      name: "叶辰",
      style: "blocked",
    });

    expect(review.ok).toBe(false);
    expect(review.suggestions).toEqual([]);
  });

  it("replaceCharacterName does not require name and stores old name in aliases", async () => {
    const { client } = await trackHarness();
    const project = await createProject();
    const character = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "旧名",
    });

    const result = await callToolData<{ character: Character }>(
      client,
      "replace_character_name",
      {
        projectId: project.id,
        characterId: character.id,
        newName: "陈明远",
      },
    );

    expect(result.character.name).toBe("陈明远");
    expect(result.character.aliases).toContain("旧名");
  });

  it("validates chapter word config order on createProject and updateProject", () => {
    const app = trackApp();

    expect(() =>
      app.services.projectService.createProject({
        name: "Bad Minimum",
        chapterWordTarget: 3000,
        minChapterWords: 3500,
        maxChapterWords: 5000,
      }),
    ).toThrow(/minChapterWords/);
    expect(() =>
      app.services.projectService.createProject({
        name: "Bad Maximum",
        chapterWordTarget: 5000,
        minChapterWords: 3000,
        maxChapterWords: 4500,
      }),
    ).toThrow(/chapterWordTarget/);

    const project = app.services.projectService.createProject({
      name: "Good Config",
      chapterWordTarget: 4000,
      minChapterWords: 3000,
      maxChapterWords: 5000,
    });

    expect(() =>
      app.services.projectService.updateProject(project.id, {
        minChapterWords: 4500,
      }),
    ).toThrow(/minChapterWords/);
    expect(() =>
      app.services.projectService.updateProject(project.id, {
        maxChapterWords: 3500,
      }),
    ).toThrow(/chapterWordTarget/);
  });
});

const shortChapterContent = "他推开门。雨声停了。";
const summaryOverPlotContent = [
  "经过三天奔走，他找到了线索。",
  "随后他决定继续追查旧账。",
  "于是他开始调查每一个相关的人。",
  "最终他意识到真相藏在账本里。",
].join("");

function trackApp(): AppInstance {
  const app = createTestApp();
  apps.push(app);
  return app;
}

async function trackHarness(): Promise<McpTestHarness> {
  const harness = await createMcpTestHarness();
  harnesses.push(harness);
  return harness;
}

async function createProject(): Promise<Project> {
  const harness = harnesses.at(-1);
  if (!harness) {
    throw new Error("MCP harness not initialized.");
  }
  return callToolData<Project>(harness.client, "create_project", {
    name: "Regression Project",
  });
}

async function createQualityProject(): Promise<Project> {
  const harness = harnesses.at(-1);
  if (!harness) {
    throw new Error("MCP harness not initialized.");
  }
  return callToolData<Project>(harness.client, "create_project", {
    name: "Quality Gate",
    chapterWordTarget: 4000,
    minChapterWords: 100,
    maxChapterWords: 5000,
  });
}
