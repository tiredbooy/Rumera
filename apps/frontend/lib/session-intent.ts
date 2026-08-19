const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * sessionStorage stash for a guest action that login would otherwise drop.
 * Removal happens before the value is returned so a remount cannot replay twice.
 */
export function stashSessionIntent(
  key: string,
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
): void {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...payload, expires_at: Date.now() + ttlMs }),
    );
  } catch {
    // Private mode / quota: losing the intent is just today's behaviour.
  }
}

export function takeSessionIntent<T>(
  key: string,
  parse: (raw: Record<string, unknown>) => T | null,
  now = Date.now(),
): T | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const expiresAt = Number(parsed.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return parse(parsed);
  } catch {
    return null;
  }
}
