/**
 * Public (unauthenticated) BFF proxy for allowlisted storefront operations.
 *
 * Browser-side public features call this SAME-origin route, and this handler
 * forwards only explicitly allowed paths to `${API}/api/v1/<path>` server-side.
 *
 * Why this exists: in production the API is bound to loopback behind a reverse
 * proxy and is NOT reachable from the browser, and `NEXT_PUBLIC_API_URL` isn't
 * inlined into the client bundle anyway. Routing through the Next.js server makes
 * these calls work identically in local dev, Docker, and production — no CORS, no
 * exposed backend.
 *
 * A strict allowlist keeps it from being used as an open proxy.
 */
import { NextResponse, type NextRequest } from "next/server"

import { API_BASE } from "@/lib/api/client"

// Exact backend paths (relative to /api/v1) this proxy is allowed to reach.
const ALLOW = new Set([
  "auth/register",
  "auth/password/forgot",
  "auth/password/reset",
  "auth/password/validate",
  "auth/otp/request",
  "categories/tree",
])

async function handle(req: NextRequest, segments: string[]) {
  const path = segments.join("/")
  if (!ALLOW.has(path)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_PATH", message: "path not allowed" } },
      { status: 403 }
    )
  }

  const target = `${API_BASE}/${path}${req.nextUrl.search}`
  const method = req.method
  const hasBody = method !== "GET" && method !== "HEAD"
  const body = hasBody ? await req.text() : undefined

  let res: Response
  try {
    res = await fetch(target, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
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
