import { mkdtempSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { AppInstance } from "../src/server.js";
import { createTestApp } from "./helpers.js";

const apps: AppInstance[] = [];
const tempDirs: string[] = [];

afterEach(() => {
  while (apps.length > 0) {
    apps.pop()?.database.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("creative engine features", () => {
  it("rejects short chapters unless an allowShortReason is provided", () => {
    const app = trackApp();
    const project = app.services.projectService.createProject({
      name: "Quality Gate",
      chapterWordTarget: 4000,
      minChapterWords: 100,
      maxChapterWords: 5000,
    });
    const content = "他推开门。雨声停了。";

    const review = app.services.chapterService.reviewChapterQuality({
      projectId: project.id,
      content,
    });

    expect(review.allowShortReasonRequired).toBe(true);
    expect(() =>
      app.services.chapterService.saveChapter({
        projectId: project.id,
        chapterIndex: 1,
        title: "短章",
        content,
      }),
    ).toThrow(/below minChapterWords/);

    const saved = app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "短章",
      content,
      allowShortReason: "序章刻意短章。",
    });
    expect(saved.wordCount).toBeLessThan(100);

    const prompt = app.services.chapterService.expandChapterPrompt({
      projectId: project.id,
      chapterIndex: 1,
      title: "短章",
      content,
    });
    expect(prompt).toContain("直接输出小说正文");
    expect(prompt).toContain("不得低于 100");
  });

  it("stores project bible, character bible fields, names, and workspace files", () => {
    const app = trackApp();
    const outputDir = mkdtempSync(join(tmpdir(), "ym-novel-export-"));
    tempDirs.push(outputDir);
    const project = app.services.projectService.createProject({
      name: "Local Epic",
      genre: "都市现实",
      chapterWordTarget: 4200,
    });

    const bible = app.services.projectBibleService.applyProjectBible({
      projectId: project.id,
      premise: "一个普通人用十年修复一座城市的旧伤。",
      logline: "旧城规划师在拆迁案中发现父亲失踪真相。",
      coreHook: "每次修复一栋楼，都会暴露一段被掩埋的关系债。",
      targetReader: "现实向长篇读者",
      genreFormula: "都市现实 + 悬疑推进 + 家族关系",
      pov: "第三人称有限视角",
      tone: "克制、真实、带温度",
      taboo: "不写空泛逆袭，不使用套路化霸总桥段",
      endingDirection: "城市更新完成，但主角接受并非所有旧伤都能愈合。",
      longTermConflict: "公共利益、私人债务与亲情真相长期拉扯。",
      chapterWordTarget: 4200,
    });

    const characters = app.services.characterService.applyCharacterBibles({
      projectId: project.id,
      characters: [
        {
          name: "陈明远",
          role: "主角",
          characterArc: "从逃避旧城记忆，到主动承担修复责任。",
          weakness: "习惯用专业判断回避情感冲突。",
          secret: "保留父亲留下的旧楼档案。",
          voice: "克制，句子短，遇到压力会反问。",
          speechHabits: "少用感叹，常说具体数字和地点。",
          moralCode: "不拿居民命运换项目速度。",
          relationshipGoal: "重新理解父亲，也学会信任同伴。",
          growthStage: "第一卷：被迫回城。",
          firstScenePlan: "雨夜回到旧规划院，发现档案柜被撬。",
        },
      ],
    });

    const review = app.services.nameService.reviewCharacterName({
      projectId: project.id,
      name: "叶辰",
      genre: "都市现实",
    });
    const generated = app.services.nameService.generateCharacterName({
      projectId: project.id,
      genre: "都市现实",
      count: 3,
    });

    const exported = app.services.workspaceExportService.exportWorkspaceFiles({
      projectId: project.id,
      outputDir,
    });

    expect(bible.coreHook).toContain("每次修复");
    expect(characters[0]?.characterArc).toContain("逃避旧城");
    expect(review.ok).toBe(false);
    expect(review.aiScore).toBeGreaterThanOrEqual(35);
    expect(generated.names).toHaveLength(3);
    expect(exported.files.some((file) => file.endsWith("project-bible.md"))).toBe(
      true,
    );
    expect(existsSync(join(outputDir, "characters", "陈明远.md"))).toBe(true);
  });
});

function trackApp(): AppInstance {
  const app = createTestApp();
  apps.push(app);
  return app;
}
