import { afterEach, describe, expect, it } from "vitest";
import type {
  ApplyPostChapterUpdateResult,
  Chapter,
  Character,
  Foreshadowing,
  Project,
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SearchAllResult,
} from "../src/types/novel.js";
import {
  callToolData,
  createMcpTestHarness,
  type McpTestHarness,
} from "./helpers.js";

type CreateSnapshotToolResult = {
  snapshotId: string;
  projectId: string;
  label?: string;
  notes?: string;
  createdAt: string;
};

const harnesses: McpTestHarness[] = [];

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop();
    await harness?.close();
  }
});

describe("phase three MCP tools", () => {
  it("applies updates, searches all sources, and manages snapshots through MCP", async () => {
    const { client } = await trackHarness();
    const toolList = await client.listTools();
    expect(toolList.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "apply_post_chapter_update",
        "search_all",
        "create_project_snapshot",
        "list_project_snapshots",
        "get_project_snapshot",
      ]),
    );

    const project = await callToolData<Project>(client, "create_project", {
      name: "第三阶段 MCP",
    });
    const character = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "沈烬",
      currentState: "入城",
      location: "听潮城",
    });
    const chapter = await callToolData<Chapter>(client, "save_chapter", {
      projectId: project.id,
      chapterIndex: 1,
      title: "黑雨入城",
      content: "沈烬进入听潮城，黑雨落下，古碑第一次裂响。",
      summary: "沈烬入城。",
      involvedCharacters: [character.id],
    });
    const foreshadowing = await callToolData<Foreshadowing>(
      client,
      "add_foreshadowing",
      {
        projectId: project.id,
        title: "古碑裂响",
        description: "古碑为何裂响仍未知。",
        expectedResolveChapter: 2,
      },
    );

    const applied = await callToolData<ApplyPostChapterUpdateResult>(
      client,
      "apply_post_chapter_update",
      {
        projectId: project.id,
        chapterIndex: 1,
        update: {
          summary: "沈烬入城并发现古碑裂响。",
          hook: "古碑裂缝里传出第二个心跳。",
          characterUpdates: [
            {
              name: "沈烬",
              currentState: "发现古碑裂响",
              location: "古碑广场",
            },
          ],
          newWorldItems: [
            {
              type: "artifact",
              name: "古碑",
              content: "古碑裂缝会传出心跳。",
              importance: 5,
            },
          ],
          newForeshadowings: [
            {
              title: "第二个心跳",
              description: "古碑裂缝里传出第二个心跳。",
              importance: 4,
            },
          ],
          resolvedForeshadowings: [
            {
              foreshadowingId: foreshadowing.id,
              notes: "古碑裂响已被心跳线索推进。",
            },
          ],
          timelineEvents: [
            {
              title: "古碑裂响",
              description: "古碑裂缝出现第二个心跳。",
              involvedCharacters: [character.id],
            },
          ],
          canonFacts: [
            {
              factType: "artifact_rule",
              content: "古碑裂缝会传出心跳。",
              importance: 5,
            },
          ],
        },
      },
    );
    const search = await callToolData<SearchAllResult>(client, "search_all", {
      projectId: project.id,
      query: "古碑",
      limit: 10,
    });
    const createdSnapshot = await callToolData<CreateSnapshotToolResult>(
      client,
      "create_project_snapshot",
      {
        projectId: project.id,
        label: "第一章后",
        notes: "MCP 工具链测试",
      },
    );
    const snapshots = await callToolData<ProjectSnapshotSummary[]>(
      client,
      "list_project_snapshots",
      {
        projectId: project.id,
      },
    );
    const snapshot = await callToolData<ProjectSnapshot>(
      client,
      "get_project_snapshot",
      {
        snapshotId: createdSnapshot.snapshotId,
      },
    );

    expect(applied.updatedChapter?.id).toBe(chapter.id);
    expect(applied.updatedCharacters[0]?.currentState).toBe("发现古碑裂响");
    expect(applied.addedCanonFacts[0]?.content).toContain("古碑裂缝");
    expect(search.results.map((item) => item.type)).toEqual(
      expect.arrayContaining(["chapters", "world_items", "canon_facts"]),
    );
    expect(snapshots.map((item) => item.id)).toContain(
      createdSnapshot.snapshotId,
    );
    expect(snapshot.content.project.id).toBe(project.id);
    expect(snapshot.content.chapters).toHaveLength(1);
  });
});

async function trackHarness(): Promise<McpTestHarness> {
  const harness = await createMcpTestHarness();
  harnesses.push(harness);
  return harness;
}
