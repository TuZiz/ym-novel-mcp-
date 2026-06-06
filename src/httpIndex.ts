import { loadConfig } from "./config/index.js";
import { startHttpMcpServer } from "./httpServer.js";

const config = loadConfig();
let handle: Awaited<ReturnType<typeof startHttpMcpServer>> | undefined;

async function main(): Promise<void> {
  handle = await startHttpMcpServer(config);
  const mcpUrl = handle.url();
  const healthUrl = mcpUrl.replace(/\/mcp$/u, "/healthz");
  const adminUrl = mcpUrl.replace(/\/mcp$/u, "/admin");

  console.error("========================================");
  console.error("[ym-novel-mcp] HTTP MCP server is READY");
  console.error(`Endpoint : ${mcpUrl}`);
  console.error(`Health   : ${healthUrl}`);
  console.error(`Admin    : ${adminUrl}`);
  console.error(`Database : ${config.dbPath}`);
  console.error(
    `Auth     : ${config.httpToken ? "token enabled" : "disabled"}`,
  );
  console.error("Press Ctrl+C to stop the server.");
  console.error("========================================");
}

process.on("SIGINT", async () => {
  await handle?.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await handle?.close();
  process.exit(0);
});

main().catch(async (error) => {
  console.error("ym-novel-mcp HTTP failed to start:", error);
  await handle?.close();
  process.exit(1);
});
