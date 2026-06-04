import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

export interface AppConfig {
  dbPath: string;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const dbPath =
    overrides?.dbPath ??
    process.env.YM_NOVEL_MCP_DB_PATH ??
    resolve(process.cwd(), "data", "novel.db");

  return {
    dbPath
  };
}
