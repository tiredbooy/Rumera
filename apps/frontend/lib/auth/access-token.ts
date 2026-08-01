import type { AuthSession } from "./types";

type AccessExpiry = { exp?: unknown };

function decodeExpiry(accessToken: string): number | null {
  try {
    const encoded = accessToken.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as AccessExpiry;
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function accessTokenNeedsRotation(
  accessToken: string | undefined,
  now = Date.now(),
): boolean {
  if (!accessToken) return true;
  const expiresAt = decodeExpiry(accessToken);
  return expiresAt === null || now >= expiresAt - 60_000;
}

export function hasTerminalRefreshError(
  error: AuthSession["error"] | undefined,
): boolean {
  return error === "RefreshAccessTokenError";
}
