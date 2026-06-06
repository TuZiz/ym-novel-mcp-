import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/index.js";
import {
  startHttpMcpServer,
  type HttpServerHandle,
} from "../src/httpServer.js";
import type { Chapter, Project } from "../src/types/novel.js";
import { callToolData } from "./helpers.js";

const handles: HttpServerHandle[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.close();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("streamable HTTP transport", () => {
  it("serves MCP tools over HTTP with token auth and SQLite persistence", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ym-novel-mcp-http-"));
    tempDirs.push(tempDir);
    const config = loadConfig({
      dbPath: join(tempDir, "novel.db"),
      httpHost: "127.0.0.1",
      httpPort: 0,
      httpToken: "test-token",
    });
    const handle = await startHttpMcpServer(config);
    handles.push(handle);

    const client = new Client({
      name: "ym-novel-mcp-http-test-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(handle.url()), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-token",
        },
      },
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("search_all");

      const project = await callToolData<Project>(client, "create_project", {
        name: "HTTP MCP smoke",
      });
      expect(project.name).toBe("HTTP MCP smoke");
    } finally {
      await client.close();
    }
  });

  it("requires a token when binding HTTP outside localhost", async () => {
    const config = loadConfig({
      dbPath: ":memory:",
      httpHost: "0.0.0.0",
      httpPort: 0,
    });

    await expect(startHttpMcpServer(config)).rejects.toThrow(
      /YM_NOVEL_MCP_TOKEN/,
    );
  });

  it("serves the web admin page and admin JSON APIs", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ym-novel-mcp-admin-"));
    tempDirs.push(tempDir);
    const config = loadConfig({
      dbPath: join(tempDir, "novel.db"),
      httpHost: "127.0.0.1",
      httpPort: 0,
      httpToken: "admin-token",
    });
    const handle = await startHttpMcpServer(config);
    handles.push(handle);
    const baseUrl = handle.url().replace(/\/mcp$/u, "");

    const page = await globalThis.fetch(`${baseUrl}/admin`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("ym-novel-mcp");

    const unauthorized = await globalThis.fetch(`${baseUrl}/admin/api/status`);
    expect(unauthorized.status).toBe(401);

    const headers = {
      Authorization: "Bearer admin-token",
      "content-type": "application/json",
    };
    const readOnlyWrite = await globalThis.fetch(`${baseUrl}/admin/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Admin Project", targetWords: 5000000 }),
    });
    expect(readOnlyWrite.status).toBe(405);

    const client = new Client({
      name: "ym-novel-mcp-admin-test-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(handle.url()), {
      requestInit: { headers },
    });
    await client.connect(transport);

    let created: Project;
    let snapshot: { snapshotId: string };
    try {
      created = await callToolData<Project>(client, "create_project", {
        name: "Admin Observed Project",
        targetWords: 5000000,
      });
      await callToolData<Chapter>(client, "save_chapter", {
        projectId: created.id,
        chapterIndex: 1,
        title: "Admin observed chapter",
        content: "第一章正文内容。主角抵达黑水城，发现青铜古镜再次发光。",
        summary: "主角抵达黑水城，青铜古镜再次发光。",
        hook: "镜中人开口叫出了主角的名字。",
      });
      snapshot = await callToolData<{ snapshotId: string }>(
        client,
        "create_project_snapshot",
        {
          projectId: created.id,
          label: "admin observed",
        },
      );
    } finally {
      await client.close();
    }
    expect(created.name).toBe("Admin Observed Project");

    const status = (await (
      await globalThis.fetch(`${baseUrl}/admin/api/status`, { headers })
    ).json()) as {
      ok: boolean;
      projectCount: number;
      tableCounts: Record<string, number>;
      dbFiles: Array<{ size: string }>;
      warnings: Array<{ severity: string; message: string }>;
      recentActivity: Array<{ type: string; title: string }>;
    };
    expect(status.ok).toBe(true);
    expect(status.projectCount).toBe(1);
    expect(status.tableCounts.project_snapshots).toBe(1);
    expect(status.dbFiles.length).toBeGreaterThan(0);
    expect(status.warnings.length).toBeGreaterThan(0);
    expect(status.recentActivity.map((item) => item.type)).toContain("snapshot");

    const snapshots = (await (
      await globalThis.fetch(
        `${baseUrl}/admin/api/snapshots?projectId=${created.id}`,
        { headers },
      )
    ).json()) as { snapshots: Array<{ id: string }> };
    expect(snapshots.snapshots.map((item) => item.id)).toContain(
      snapshot.snapshotId,
    );

    const writing = (await (
      await globalThis.fetch(
        `${baseUrl}/admin/api/writing-monitor?projectId=${created.id}`,
        { headers },
      )
    ).json()) as {
      toolCalls: Array<{ toolName: string; contentPreview: string | null }>;
      recentWrites: Array<{ type: string; title: string; content: string }>;
      pipelines: Array<{
        projectId: string;
        steps: Array<{ toolName: string; status: string }>;
      }>;
    };
    expect(writing.toolCalls.map((item) => item.toolName)).toContain(
      "save_chapter",
    );
    expect(writing.toolCalls.map((item) => item.toolName)).toContain(
      "create_project_snapshot",
    );
    expect(writing.recentWrites.map((item) => item.title)).toContain(
      "Admin observed chapter",
    );
    expect(writing.recentWrites.some((item) => item.content.includes("黑水城"))).toBe(
      true,
    );
    const pipeline = writing.pipelines.find((item) => item.projectId === created.id);
    expect(pipeline?.steps).toContainEqual(
      expect.objectContaining({
        toolName: "save_chapter",
        status: "ok",
      }),
    );
  });
});
