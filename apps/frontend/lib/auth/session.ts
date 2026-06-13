/**
 * Server-side guards. Layouts and pages call these to enforce access; each one
 * `redirect()`s on failure (which throws, so control never returns) and returns
 * a narrowed, non-null session on success.
 *
 * Defense-in-depth: middleware does the coarse edge check, these do the
 * authoritative server check, and `requirePermission` adds per-feature gating.
 */
import "server-only"
import { redirect } from "next/navigation"

import { auth } from "./auth"
import { isStaff } from "@/lib/rbac/roles"
import { can } from "@/lib/rbac/can"
import type { Permission } from "@/lib/rbac/permissions"

export function getSession() {
  return auth()
}

export async function requireUser(callbackUrl = "/account") {
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  return session
}

export async function requireStaff(callbackUrl = "/admin") {
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  if (!isStaff(session.role)) {
    redirect("/forbidden")
  }
  return session
}

export async function requirePermission(permission: Permission, callbackUrl = "/admin") {
  const session = await requireStaff(callbackUrl)
  if (!can(session, permission)) {
    redirect("/forbidden")
  }
  return session
}
