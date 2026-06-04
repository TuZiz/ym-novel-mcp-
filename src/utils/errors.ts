export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APP_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assertFound<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new AppError(message, "NOT_FOUND");
  }

  return value;
}
