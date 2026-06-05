import { afterEach, describe, expect, it } from "vitest";
import type {
  Chapter,
  Character,
  Project,
  WorldItem,
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

describe("MCP resources and prompts", () => {
  it("lists and reads project-scoped JSON resources", async () => {
    const { client } = await trackHarness();
    const project = await callToolData<Project>(client, "create_project", {
      name: "资源巡检",
    });
    const character = await callToolData<Character>(client, "add_character", {
      projectId: project.id,
      name: "林澈",
      role: "主角",
    });
    const worldItem = await callToolData<WorldItem>(client, "add_world_item", {
      projectId: project.id,
      type: "location",
      name: "沉星港",
      content: "沉星港每逢朔夜封港。",
    });

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining([
        "novel://projects",
        `novel://project/${project.id}`,
        `novel://project/${project.id}/characters`,
        `novel://project/${project.id}/world`,
      ]),
    );

    const templates = await client.listResourceTemplates();
    expect(
      templates.resourceTemplates.map((template) => template.uriTemplate),
    ).toEqual(
      expect.arrayContaining([
        "novel://project/{projectId}",
        "novel://project/{projectId}/characters",
        "novel://project/{projectId}/world",
      ]),
    );

    const projects = await readJsonResource<Project[]>(
      client,
      "novel://projects",
    );
    const characters = await readJsonResource<Character[]>(
      client,
      `novel://project/${project.id}/characters`,
    );
    const worldItems = await readJsonResource<WorldItem[]>(
      client,
      `novel://project/${project.id}/world`,
    );

    expect(projects.map((item) => item.id)).toContain(project.id);
    expect(characters.map((item) => item.id)).toContain(character.id);
    expect(worldItems.map((item) => item.id)).toContain(worldItem.id);
  });

  it("lists prompts and builds prompt messages through MCP", async () => {
    const { client } = await trackHarness();
    const project = await callToolData<Project>(client, "create_project", {
      name: "提示词巡检",
    });
    await callToolData<Chapter>(client, "save_chapter", {
      projectId: project.id,
      chapterIndex: 1,
      title: "第一章",
      content: "林澈抵达沉星港，发现港口所有钟声都停在子夜。",
      summary: "林澈抵达沉星港并发现钟声异常。",
    });

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining([
        "write-next-chapter",
        "summarize-chapter",
        "extract-canon",
        "continuity-review",
      ]),
    );

    const summaryPrompt = await client.getPrompt({
      name: "summarize-chapter",
      arguments: {
        projectId: project.id,
        chapterIndex: "1",
      },
    });
    const continuityPrompt = await client.getPrompt({
      name: "continuity-review",
      arguments: {
        projectId: project.id,
        draftContent: "林澈在沉星港听见停摆的钟声重新响起。",
      },
    });

    expect(readFirstText(summaryPrompt.messages)).toContain(
      "120-200 字中文摘要",
    );
    expect(readFirstText(continuityPrompt.messages)).toContain("连续性审校");
  });
});

async function trackHarness(): Promise<McpTestHarness> {
  const harness = await createMcpTestHarness();
  harnesses.push(harness);
  return harness;
}

async function readJsonResource<T>(
  client: McpTestHarness["client"],
  uri: string,
): Promise<T> {
  const result = await client.readResource({ uri });
  const first = result.contents[0];
  if (!first || !("text" in first)) {
    throw new Error(`Resource ${uri} did not return text JSON.`);
  }

  return JSON.parse(first.text) as T;
}

function readFirstText(
  messages: Awaited<
    ReturnType<McpTestHarness["client"]["getPrompt"]>
  >["messages"],
): string {
  const first = messages[0];
  if (!first || first.content.type !== "text") {
    throw new Error("Prompt did not return a text message.");
  }

  return first.content.text;
}
