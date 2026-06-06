import { Buffer } from "node:buffer";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { handleAdminRequest } from "./adminWeb.js";
import type { AppConfig } from "./config/index.js";
import { createApp, type AppInstance } from "./server.js";

type HttpSession = {
  app: AppInstance;
  transport: StreamableHTTPServerTransport;
  closed: boolean;
};

export type HttpServerHandle = {
  close(): Promise<void>;
  url(): string;
};

export async function startHttpMcpServer(
  config: AppConfig,
): Promise<HttpServerHandle> {
  assertHttpSecurity(config);

  const sessions = new Map<string, HttpSession>();
  const adminApp = createApp(config);
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        writeCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
      }

      if (await handleAdminRequest(req, res, config, adminApp)) {
        return;
      }

      if (req.url === "/healthz" && req.method === "GET") {
        writeJson(res, 200, {
          ok: true,
          transport: "streamable-http",
          dbPath: config.dbPath,
        });
        return;
      }

      if (req.url !== "/mcp") {
        writeJson(res, 404, { error: "Not found" });
        return;
      }

      if (!isAuthorized(req, config.httpToken)) {
        writeJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "POST") {
        await handlePost(req, res, config, sessions);
        return;
      }

      if (req.method === "GET") {
        await handleSessionRequest(req, res, sessions, false);
        return;
      }

      if (req.method === "DELETE") {
        await handleSessionRequest(req, res, sessions, true);
        return;
      }

      writeJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
      console.error("ym-novel-mcp HTTP request failed:", error);
      if (!res.headersSent) {
        writeJson(res, 500, { error: "Internal server error" });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.httpPort, config.httpHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    async close() {
      await Promise.all(
        [...sessions.values()].map(async (session) => {
          await closeSession(session, false);
        }),
      );
      sessions.clear();
      await adminApp.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    url() {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : config.httpPort;
      return `http://${config.httpHost}:${port}/mcp`;
    },
  };
}

function assertHttpSecurity(config: AppConfig): void {
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (
    !localHosts.has(config.httpHost) &&
    !config.httpToken &&
    !config.allowUnauthenticatedHttp
  ) {
    throw new Error(
      "YM_NOVEL_MCP_TOKEN is required when HTTP host is not localhost. Set YM_NOVEL_MCP_ALLOW_UNAUTH_HTTP=true only for trusted private networks.",
    );
  }
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
  sessions: Map<string, HttpSession>,
): Promise<void> {
  const body = await readJsonBody(req);
  const sessionId = getHeader(req, "mcp-session-id");
  const existing = sessionId ? sessions.get(sessionId) : undefined;

  if (existing) {
    await existing.transport.handleRequest(req, res, body);
    return;
  }

  if (sessionId || !isInitializeRequest(body)) {
    writeJson(res, 400, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid MCP session.",
      },
      id: null,
    });
    return;
  }

  let initializedSessionId: string | undefined;
  const app = createApp(config);
  let session: HttpSession;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized(id) {
      initializedSessionId = id;
      sessions.set(id, session);
    },
  });
  session = { app, transport, closed: false };

  transport.onclose = () => {
    const id = transport.sessionId ?? initializedSessionId;
    if (id) {
      sessions.delete(id);
    }
    closeSession(session, true).catch((error) => {
      console.error("ym-novel-mcp HTTP session cleanup failed:", error);
    });
  };

  await app.server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function handleSessionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, HttpSession>,
  closeAfterRequest: boolean,
): Promise<void> {
  const sessionId = getHeader(req, "mcp-session-id");
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    writeJson(res, 400, { error: "Invalid or missing MCP session ID." });
    return;
  }

  await session.transport.handleRequest(req, res);

  if (closeAfterRequest) {
    if (!sessionId) {
      return;
    }
    sessions.delete(sessionId);
    await closeSession(session, true);
  }
}

async function closeSession(
  session: HttpSession,
  transportAlreadyClosed: boolean,
): Promise<void> {
  if (session.closed) {
    return;
  }

  session.closed = true;
  session.transport.onclose = undefined;

  if (transportAlreadyClosed) {
    session.app.database.close();
    return;
  }

  await session.app.close();
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function isAuthorized(
  req: IncomingMessage,
  token: string | undefined,
): boolean {
  if (!token) {
    return true;
  }

  const auth = getHeader(req, "authorization");
  const headerToken = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const alternateToken = getHeader(req, "x-ym-novel-mcp-token");
  const candidate = headerToken ?? alternateToken;
  if (!candidate) {
    return false;
  }

  const expected = Buffer.from(token);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  writeCorsHeaders(res);
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function writeCorsHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader(
    "access-control-allow-headers",
    "content-type, authorization, mcp-session-id, last-event-id, x-ym-novel-mcp-token",
  );
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}
