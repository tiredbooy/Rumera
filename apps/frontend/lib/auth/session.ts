/**
 * Server-side guards. Layouts and pages call these to enforce access; each one
 * `redirect()`s on failure (which throws, so control never returns) and returns
 * a narrowed, non-null session on success.
 *
 * Defense-in-depth: middleware does the coarse edge check and these repeat the
 * admin-role check on the server. `requirePermission` also keeps frontend
 * capability-gated pages consistent inside that admin-only boundary.
 */
import "server-only";
import { redirect } from "next/navigation";

import { auth } from "./auth";
import { getLiveAccount } from "./live-account";
import { isStaff, permissionsForRole } from "@/lib/rbac/roles";
import { can } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/permissions";

export class LiveAuthorizationUnavailableError extends Error {
  constructor() {
    super("live authorization check unavailable");
    this.name = "LiveAuthorizationUnavailableError";
  }
}

export function getSession() {
  return auth();
}

export async function requireUser(callbackUrl = "/account") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (session.error === "RefreshRequired") {
    redirect(
      `/api/auth/refresh-session?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }
  if (session.error === "RefreshAccessTokenError") {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}

export async function requireStaff(callbackUrl = "/admin") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (session.error === "RefreshRequired") {
    redirect(
      `/api/auth/refresh-session?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }
  if (session.error === "RefreshAccessTokenError") {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const live = await getLiveAccount(session.accessToken);
  if (live.status === "unavailable") {
    throw new LiveAuthorizationUnavailableError();
  }
  if (live.status === "revoked" || !isStaff(live.profile.role)) {
    redirect("/forbidden");
  }

  const fullName = [live.profile.first_name, live.profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    ...session,
    role: "admin" as const,
    permissions: permissionsForRole("admin"),
    user: {
      ...session.user,
      id: live.profile.user_id,
      email: live.profile.email,
      name: fullName || session.user.name || live.profile.email,
    },
  };
}

export async function requirePermission(
  permission: Permission,
  callbackUrl = "/admin",
) {
  const session = await requireStaff(callbackUrl);
  if (!can(session, permission)) {
    redirect("/forbidden");
  }
  return session;
}
