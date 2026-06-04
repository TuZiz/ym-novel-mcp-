export function nowIso(): string {
  return new Date().toISOString();
}

export function serializeStringArray(values?: string[] | null): string {
  return JSON.stringify(values ?? []);
}

export function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

export function countWords(text: string): number {
  const hanCount = [...text.matchAll(/\p{Script=Han}/gu)].length;
  const latinCount = text
    .replace(/\p{Script=Han}/gu, " ")
    .match(/[A-Za-z0-9_'-]+/g)?.length ?? 0;

  return hanCount + latinCount;
}

export function excerptStart(text: string, limit = 120): string | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, limit);
}

export function excerptEnd(text: string, limit = 120): string | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(Math.max(0, normalized.length - limit));
}

export function buildFtsQuery(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" AND ");
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function compactText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join("\n");
}
