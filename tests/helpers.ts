import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApp, type AppInstance } from "../src/server.js";

export type McpTestHarness = {
  client: Client;
  close(): Promise<void>;
};

export function createTestApp(): AppInstance {
  return createApp({ dbPath: ":memory:" });
}

export async function createMcpTestHarness(): Promise<McpTestHarness> {
  const app = createTestApp();
  const client = new Client({
    name: "ym-novel-mcp-test-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await app.server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    async close() {
      await client.close();
      await app.close();
    },
  };
}

export async function callToolData<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await client.callTool({
    name,
    arguments: args,
  });

  if ("toolResult" in result) {
    throw new Error(`Unexpected task tool result for ${name}.`);
  }

  const payload = result.structuredContent;
  if (!isToolPayload(payload)) {
    throw new Error(`Tool ${name} did not return the expected JSON payload.`);
  }

  if (result.isError || payload.ok !== true) {
    throw new Error(`Tool ${name} failed: ${JSON.stringify(payload.error)}`);
  }

  return payload.data as T;
}

function isToolPayload(value: unknown): value is {
  ok: boolean;
  data: unknown;
  error?: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    ("data" in value || "error" in value)
  );
}
