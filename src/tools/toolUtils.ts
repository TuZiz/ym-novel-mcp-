import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { AppError } from "../utils/errors.js";

export function jsonToolResult(data: unknown) {
  const payload = {
    ok: true,
    data
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

export function jsonToolError(error: unknown) {
  const payload = {
    ok: false,
    error: normalizeError(error)
  };

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

export function wrapToolHandler<TArgs, TResult>(
  handler: (args: TArgs) => TResult | Promise<TResult>,
  options?: {
    services: AppServices;
    toolName: string;
  },
) {
  return async (args: TArgs) => {
    const startedAt = Date.now();
    const projectId = extractProjectId(args);
    try {
      const result = await handler(args);
      options?.services.mcpCallLogService.record({
        projectId,
        toolName: options.toolName,
        status: "ok",
        durationMs: Date.now() - startedAt,
        inputPreview: previewValue(args),
        outputPreview: previewValue(result),
        contentPreview: extractContentPreview(args, result),
      });
      return jsonToolResult(result);
    } catch (error) {
      options?.services.mcpCallLogService.record({
        projectId,
        toolName: options.toolName,
        status: "error",
        durationMs: Date.now() - startedAt,
        inputPreview: previewValue(args),
        errorMessage: normalizeError(error).message,
        contentPreview: extractContentPreview(args),
      });
      return jsonToolError(error);
    }
  };
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof z.ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: z.prettifyError(error)
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unknown error."
  };
}

function extractProjectId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.projectId === "string" ? value.projectId : null;
}

function extractContentPreview(input: unknown, output?: unknown): string | null {
  const candidates = [input, output].flatMap((value) => collectTextCandidates(value));
  const content = candidates.find((item) => item.trim().length > 0);
  return content ? truncate(content.replace(/\s+/gu, " ").trim(), 900) : null;
}

function collectTextCandidates(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const direct = [
    value.content,
    value.summary,
    value.hook,
    value.description,
    value.title,
  ].filter((item): item is string => typeof item === "string");

  const nested = Object.values(value).flatMap((item) => {
    if (Array.isArray(item)) {
      return item.flatMap((entry) => collectTextCandidates(entry));
    }
    return isRecord(item) ? collectTextCandidates(item) : [];
  });

  return [...direct, ...nested];
}

function previewValue(value: unknown): string {
  const serialized = JSON.stringify(redactLargeContent(value), null, 2);
  return truncate(serialized ?? "", 1400);
}

function redactLargeContent(value: unknown): unknown {
  if (typeof value === "string") {
    return truncate(value.replace(/\s+/gu, " ").trim(), 260);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map(redactLargeContent);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactLargeContent(item)]),
  );
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
