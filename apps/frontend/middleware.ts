/**
 * Edge middleware — the first (coarse) line of access control, plus crawler
 * hygiene for private areas.
 *
 * It runs on the Edge runtime, so it uses the Node-free `authConfig`
 * (`lib/auth/auth.config.ts`). Authoritative checks still happen server-side in
 * the route layouts (`requireUser` / `requireStaff` / `requirePermission`); this
 * just bounces obvious cases early and tags dashboards `noindex`.
 */
import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/lib/auth/auth.config"
import { isStaff } from "@/lib/rbac/roles"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const path = nextUrl.pathname
  const session = req.auth

  const isAccount = path.startsWith("/account")
  const isAdmin = path.startsWith("/admin")

  if (!isAccount && !isAdmin) {
    return NextResponse.next()
  }

  // Not signed in → send to login, remembering where they were headed.
  if (!session?.user) {
    const url = new URL("/login", nextUrl)
    url.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(url)
  }

  // Signed in but not staff → keep them out of the admin console.
  if (isAdmin && !isStaff(session.role)) {
    return NextResponse.redirect(new URL("/forbidden", nextUrl))
  }

  // Private surface — never index, never follow.
  const res = NextResponse.next()
  res.headers.set("X-Robots-Tag", "noindex, nofollow")
  return res
})

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
}
