import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import type { Project } from "../src/types/novel.js";
import { callToolData } from "./helpers.js";

describe("stdio entrypoint", () => {
  it("starts the MCP server through stdio and handles tool calls", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ym-novel-mcp-"));
    const stderrLines: string[] = [];
    const client = new Client({
      name: "ym-novel-mcp-stdio-test-client",
      version: "1.0.0",
    });
    const transport = new StdioClientTransport({
      command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      args: ["exec", "tsx", "src/index.ts"],
      cwd: process.cwd(),
      env: {
        YM_NOVEL_MCP_DB_PATH: join(tempDir, "novel.db"),
      },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk) => {
      stderrLines.push(String(chunk));
    });

    try {
      await client.connect(transport);

      const toolList = await client.listTools();
      expect(toolList.tools.map((tool) => tool.name)).toContain(
        "create_project",
      );

      const project = await callToolData<Project>(client, "create_project", {
        name: "stdio smoke",
      });
      expect(project.name).toBe("stdio smoke");
    } catch (error) {
      throw new Error(
        `stdio MCP smoke test failed: ${
          error instanceof Error ? error.message : String(error)
        }\nserver stderr:\n${stderrLines.join("")}`,
      );
    } finally {
      await client.close();
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
