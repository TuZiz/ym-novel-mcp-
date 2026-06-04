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

describe("continuity service", () => {
  it("returns warnings for obvious continuity conflicts", () => {
    const app = createTestApp();
    apps.push(app);

    const project = app.services.projectService.createProject({
      name: "碑海长夜"
    });
    const hero = app.services.characterService.addCharacter({
      projectId: project.id,
      name: "林夜",
      location: "听潮城",
      currentState: "昏迷中"
    });
    app.services.characterService.updateCharacterState({
      projectId: project.id,
      characterId: hero.id,
      status: "dead",
      currentState: "昏迷中"
    });
    const location = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "听潮城",
      content: "东海边的贸易大城。",
      importance: 5
    });
    const forbiddenLand = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "location",
      name: "锁渊塔",
      content: "城外禁塔。",
      importance: 4
    });
    const rule = app.services.worldService.addWorldItem({
      projectId: project.id,
      type: "world_rule",
      name: "天机禁制",
      content: "任何人使用天机禁制都必须付出巨大代价，不可无视。",
      importance: 5
    });
    app.services.chapterService.saveChapter({
      projectId: project.id,
      chapterIndex: 1,
      title: "裂碑",
      content: "古碑碎裂后，众人只看到黑门开始震动。",
      summary: "黑门初震。",
      hook: "黑门开始震动。"
    });

    for (let index = 0; index < 6; index += 1) {
      app.services.foreshadowingService.addForeshadowing({
        projectId: project.id,
        title: `未解之谜-${index}`,
        description: `尚未解释的异象 ${index}`
      });
    }

    const result = app.services.continuityService.checkContinuity({
      projectId: project.id,
      chapterIndex: 2,
      relatedCharacterIds: [hero.id],
      relatedWorldItemIds: [location.id, forbiddenLand.id, rule.id],
      draftContent:
        "林夜在锁渊塔前毫无代价地启动天机禁制，大笑着奔跑冲锋，像什么都没发生过。"
    });

    expect(result.ok).toBe(false);
    expect(result.warnings.map((warning) => warning.type)).toEqual(
      expect.arrayContaining([
        "character_status_conflict",
        "character_state_conflict",
        "character_location_conflict",
        "world_rule_conflict",
        "foreshadowing_backlog",
        "hook_carryover_risk"
      ])
    );
  });
});
