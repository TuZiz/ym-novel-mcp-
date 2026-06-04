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
  handler: (args: TArgs) => TResult | Promise<TResult>
) {
  return async (args: TArgs) => {
    try {
      return jsonToolResult(await handler(args));
    } catch (error) {
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
