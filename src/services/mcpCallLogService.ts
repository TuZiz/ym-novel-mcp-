import type Database from "better-sqlite3";
import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/text.js";

export interface McpCallLogInput {
  projectId?: string | null;
  toolName: string;
  status: "ok" | "error";
  durationMs: number;
  inputPreview?: string | null;
  outputPreview?: string | null;
  contentPreview?: string | null;
  errorMessage?: string | null;
}

export interface McpCallLogRecord {
  id: string;
  projectId: string | null;
  toolName: string;
  status: string;
  durationMs: number;
  inputPreview: string | null;
  outputPreview: string | null;
  contentPreview: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export class McpCallLogService {
  constructor(private readonly db: Database.Database) {}

  record(input: McpCallLogInput): void {
    this.db
      .prepare(
        `INSERT INTO mcp_call_logs (
          id, project_id, tool_name, status, duration_ms, input_preview,
          output_preview, content_preview, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        createId("call"),
        input.projectId ?? null,
        input.toolName,
        input.status,
        input.durationMs,
        input.inputPreview ?? null,
        input.outputPreview ?? null,
        input.contentPreview ?? null,
        input.errorMessage ?? null,
        nowIso(),
      );
  }

  listRecent(projectId?: string, limit = 40): McpCallLogRecord[] {
    const rows = projectId
      ? this.db
          .prepare(
            `SELECT * FROM mcp_call_logs
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
          )
          .all(projectId, limit)
      : this.db
          .prepare(
            `SELECT * FROM mcp_call_logs
            ORDER BY created_at DESC
            LIMIT ?`,
          )
          .all(limit);

    return (rows as Record<string, unknown>[]).map(mapMcpCallLogRow);
  }
}

function mapMcpCallLogRow(row: Record<string, unknown>): McpCallLogRecord {
  return {
    id: String(row.id),
    projectId: (row.project_id as string | null) ?? null,
    toolName: String(row.tool_name),
    status: String(row.status),
    durationMs: Number(row.duration_ms ?? 0),
    inputPreview: (row.input_preview as string | null) ?? null,
    outputPreview: (row.output_preview as string | null) ?? null,
    contentPreview: (row.content_preview as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}
