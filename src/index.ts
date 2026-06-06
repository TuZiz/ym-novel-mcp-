import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "./server.js";

const app = createApp();
const transport = new StdioServerTransport();

async function main(): Promise<void> {
  await app.server.connect(transport);
  console.error("========================================");
  console.error("[ym-novel-mcp] stdio MCP server is READY");
  console.error(`Database : ${app.config.dbPath}`);
  console.error("Status   : waiting for an MCP client over stdio");
  console.error("Note     : this window is not an interactive shell.");
  console.error("========================================");
}

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});

main().catch(async (error) => {
  console.error("ym-novel-mcp failed to start:", error);
  await app.close();
  process.exit(1);
});
