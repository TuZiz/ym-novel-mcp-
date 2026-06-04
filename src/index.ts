import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "./server.js";

const app = createApp();
const transport = new StdioServerTransport();

async function main(): Promise<void> {
  await app.server.connect(transport);
  console.error(`ym-novel-mcp running on stdio with db=${app.config.dbPath}`);
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
