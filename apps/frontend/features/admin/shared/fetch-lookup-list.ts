import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";

const LIMIT_PARAM = /(?:\?|&)limit=(\d+)(?:&|$)/;

/**
 * Server-only paginated lookup (`{ results, pagination }`).
 * Callers must pass a legal `limit` (1–100). Failures propagate.
 */
export async function fetchLookupList<T>(path: string): Promise<T[]> {
  const match = LIMIT_PARAM.exec(path);
  const limit = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error(
      `fetchLookupList: limit must be 1–100 (got ${match?.[1] ?? "missing"})`,
    );
  }

  return (await apiFetch<Paginated<T>>(path)).results ?? [];
}
