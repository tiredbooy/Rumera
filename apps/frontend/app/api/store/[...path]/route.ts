/**
 * Authenticated BFF proxy. Client React Query hooks call `/api/store/<path>`;
 * this forwards to `${API}/api/v1/<path>` with the caller's bearer token taken
 * from the next-auth session (server-side, with silent refresh) — so the access
 * token never reaches the browser.
 *
 * A path allowlist limits it to per-user / checkout resources, so it can't be
 * used as an open proxy.
 */
import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

import { auth } from "@/lib/auth/auth"
import { API_BASE } from "@/lib/api/client"

/**
 * Read the *raw* next-auth JWT (which carries the server-only `refreshToken`)
 * from the encrypted session cookie. Keeps the refresh token server-side; the
 * cookie name / salt are derived from the request protocol so it works in dev,
 * Docker, and prod.
 */
async function readRefreshToken(req: NextRequest): Promise<string | undefined> {
  const secureCookie = req.nextUrl.protocol === "https:"
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  })
  return (token?.refreshToken as string | undefined) ?? undefined
}

/** Exchange the refresh token for a fresh access token via the backend. */
async function refreshAccessToken(refreshToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    })
    if (!res.ok) return undefined
    const { data } = await res.json()
    return (data?.access_token as string | undefined) ?? undefined
  } catch {
    return undefined
  }
}

const ALLOW = new Set([
  "cart",
  "orders",
  "addresses",
  "coupons",
  "shipping",
  "wallet",
  "wishlist",
  "reviews",
  "alerts",
  // `auth` is allowlisted only so the self-service profile routes
  // (GET/PATCH /auth/me) can be proxied; every /auth/* backend route enforces
  // its own guard (e.g. /auth/me sits behind the Auth middleware).
  "auth",
  "loyalty",
  "referrals",
  "gift-cards",
  "subscriptions",
  "recommendations",
  // `me` covers the per-user personalization routes (GET/PUT /me/taste-profile).
  // Every /me/* backend route sits behind the Auth middleware, so the storefront
  // can safely proxy it. Without this the entire taste/personalization surface
  // 403s before reaching the backend.
  "me",
])

async function handle(req: NextRequest, segments: string[]) {
  if (!segments.length || !ALLOW.has(segments[0])) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_PATH", message: "path not allowed" } },
      { status: 403 }
    )
  }

  const session = await auth()
  const target = `${API_BASE}/${segments.join("/")}${req.nextUrl.search}`
  const method = req.method
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE"
  const body = hasBody ? await req.text() : undefined

  const sendUpstream = (accessToken?: string) =>
    fetch(target, {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    })

  let res: Response
  try {
    res = await sendUpstream(session?.accessToken)

    // Access token expired mid-request → try ONE silent refresh + retry. If the
    // refresh fails we return the original 401 and the client-side SessionGuard
    // signs the user out.
    if (res.status === 401 && session?.accessToken) {
      const refreshToken = await readRefreshToken(req)
      if (refreshToken) {
        const fresh = await refreshAccessToken(refreshToken)
        if (fresh) res = await sendUpstream(fresh)
      }
    }
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "could not reach API" } },
      { status: 502 }
    )
  }

  if (res.status === 204) return new NextResponse(null, { status: 204 })

  // Pass the backend's JSON (and status) through unchanged.
  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
