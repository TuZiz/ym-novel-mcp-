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

describe("project service", () => {
  it("creates a project with default writing rules", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "长夜余烬",
      genre: "玄幻",
      targetWords: 8_000_000
    });

    expect(project.name).toBe("长夜余烬");
    expect(project.currentWords).toBe(0);
    expect(app.services.projectService.listProjects()).toHaveLength(1);
    const rules = app.services.projectService.listWritingRules(project.id);
    expect(rules).toHaveLength(21);
    expect(rules.map((rule) => rule.content)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("build_next_chapter_context"),
        expect.stringContaining("review_chapter_quality"),
        expect.stringContaining("save_chapter_with_quality_gate"),
        expect.stringContaining("build_post_chapter_update_prompt"),
        expect.stringContaining("apply_post_chapter_update"),
      ]),
    );
  });

  it("adds character and world item to a project", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "赤潮行纪"
    });

    const character = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "沈烬",
      role: "主角",
      currentState: "潜入宗门"
    });
    const worldItem = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "听潮城",
      content: "东海边最大的修士贸易港。",
      tags: ["主城", "海港"]
    });

    expect(character.name).toBe("沈烬");
    expect(worldItem.tags).toContain("海港");
  });
});
