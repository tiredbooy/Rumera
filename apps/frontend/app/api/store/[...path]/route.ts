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

import { auth } from "@/lib/auth/auth"
import { API_BASE } from "@/lib/api/client"

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
  "me",
  "loyalty",
  "referrals",
  "gift-cards",
  "subscriptions",
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

  let res: Response
  try {
    res = await fetch(target, {
      method,
      headers: {
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    })
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
