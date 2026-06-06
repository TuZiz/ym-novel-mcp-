import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

export interface AppConfig {
  dbPath: string;
  httpHost: string;
  httpPort: number;
  httpToken?: string;
  allowUnauthenticatedHttp: boolean;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const dbPath =
    overrides?.dbPath ??
    process.env.YM_NOVEL_MCP_DB_PATH ??
    resolve(process.cwd(), "data", "novel.db");
  const httpHost =
    overrides?.httpHost ?? process.env.YM_NOVEL_MCP_HTTP_HOST ?? "127.0.0.1";
  const httpPort =
    overrides?.httpPort ??
    parsePositiveInteger(process.env.YM_NOVEL_MCP_HTTP_PORT, 52778);
  const httpToken = overrides?.httpToken ?? process.env.YM_NOVEL_MCP_TOKEN;
  const allowUnauthenticatedHttp =
    overrides?.allowUnauthenticatedHttp ??
    process.env.YM_NOVEL_MCP_ALLOW_UNAUTH_HTTP === "true";

  return {
    dbPath,
    httpHost,
    httpPort,
    httpToken,
    allowUnauthenticatedHttp,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
