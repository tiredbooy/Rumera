import "server-only";

import type { UserProfile } from "@/features/profile/types";
import { API_BASE } from "@/lib/api/base";
import type { ApiSuccess } from "@/lib/api/types";
import { isRole } from "@/lib/rbac/roles";

export type LiveAccountResult =
  | { status: "active"; profile: UserProfile }
  | { status: "revoked" }
  | { status: "unavailable" };

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.user_id === "string" &&
    profile.user_id.length > 0 &&
    typeof profile.email === "string" &&
    isRole(profile.role)
  );
}

/**
 * Re-read the account through the backend's authenticated `/auth/me` endpoint.
 * A successful response proves the account is still active; the returned role
 * is the live database role injected by backend auth middleware.
 */
export async function getLiveAccount(
  accessToken: string | undefined,
): Promise<LiveAccountResult> {
  if (!accessToken) return { status: "unavailable" };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: "revoked" };
  }
  if (!response.ok) return { status: "unavailable" };

  const body: unknown = await response.json().catch(() => null);
  const profile = (body as ApiSuccess<unknown> | null)?.data;
  return isUserProfile(profile)
    ? { status: "active", profile }
    : { status: "unavailable" };
}
