import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppInstance } from "../src/server.js";

const apps: AppInstance[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    await app?.close();
  }

  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  }
});

describe("FTS repair", () => {
  it("keeps world item tags indexed in the same format used by repairs", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ym-novel-mcp-fts-"));
    tempDirs.push(tempDir);
    const app = createTrackedApp(join(tempDir, "novel.db"));
    const project = app.services.projectService.createProject({
      name: "标签索引",
    });
    const worldItem = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "听潮城",
      content: "东海边最大的修士贸易港。",
      tags: ["主城", "海港"],
    });

    const ftsRow = app.database.db
      .prepare("SELECT tags FROM world_items_fts WHERE world_item_id = ?")
      .get(worldItem.id) as { tags: string };
    const matches = app.services.worldService.searchWorldItems(
      project.id,
      "海港",
      undefined,
      5,
    );

    expect(ftsRow.tags).toBe(JSON.stringify(worldItem.tags));
    expect(matches.map((item) => item.id)).toContain(worldItem.id);
  });

  it("rebuilds stale chapter and world indexes on startup", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ym-novel-mcp-fts-"));
    tempDirs.push(tempDir);
    const dbPath = join(tempDir, "novel.db");
    const app = createTrackedApp(dbPath);

    const project = app.services.projectService.createProject({
      name: "检索修复",
    });
    const chapter = app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "旧钟",
      content: "旧钟线索已经失效。",
      summary: "旧钟线索。",
    });
    const worldItem = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "artifact",
      name: "旧钟",
      content: "旧钟会在子夜响起。",
      tags: ["旧钟"],
    });

    app.database.db
      .prepare(
        "UPDATE chapters SET title = ?, content = ?, summary = ? WHERE id = ?",
      )
      .run("新碑", "新碑线索已经生效。", "新碑线索。", chapter.id);
    app.database.db
      .prepare(
        "UPDATE world_items SET name = ?, content = ?, tags = ? WHERE id = ?",
      )
      .run(
        "新碑",
        "新碑会在黎明发光。",
        JSON.stringify(["新碑"]),
        worldItem.id,
      );

    await closeTrackedApp(app);
    const reopened = createTrackedApp(dbPath);

    expect(
      reopened.services.chapterService.searchChapters(project.id, "旧钟", 5),
    ).toEqual([]);
    expect(
      reopened.services.chapterService.searchChapters(project.id, "新碑", 5),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: chapter.id })]),
    );
    expect(
      reopened.services.worldService.searchWorldItems(
        project.id,
        "旧钟",
        undefined,
        5,
      ),
    ).toEqual([]);
    expect(
      reopened.services.worldService.searchWorldItems(
        project.id,
        "新碑",
        undefined,
        5,
      ),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: worldItem.id })]),
    );
  });
});

function createTrackedApp(dbPath: string): AppInstance {
  const app = createApp({ dbPath });
  apps.push(app);
  return app;
}

async function closeTrackedApp(app: AppInstance): Promise<void> {
  const index = apps.indexOf(app);
  if (index >= 0) {
    apps.splice(index, 1);
  }

  await app.close();
}
