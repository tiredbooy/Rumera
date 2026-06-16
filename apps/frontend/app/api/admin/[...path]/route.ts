/**
 * Authenticated BFF proxy for the admin dashboard. Client hooks call
 * `/api/admin/<backend-path>`; this forwards to `${API}/api/v1/<backend-path>`
 * with the caller's bearer token from the next-auth session — so the access
 * token never reaches the browser and admin endpoints work identically in dev,
 * Docker, and prod (where the API is loopback-only behind a reverse proxy).
 *
 * `<backend-path>` is the path *after* `/api/v1`, so admin-namespaced endpoints
 * include the `admin/` segment, e.g. the create-product call hits
 * `/api/admin/admin/products`. Read-only catalogue lookups the form needs
 * (`products/:id`, `categories`, `brands`, `tags`) are reached the same way.
 *
 * Two guards keep this from being an open proxy: the caller must be staff, and
 * the first path segment must be on the allowlist. The backend still enforces
 * per-permission RBAC on top.
 *
 * Unlike `/api/store`, this preserves `multipart/form-data` bodies verbatim so
 * image uploads pass through with their boundary intact.
 */
import { NextResponse, type NextRequest } from "next/server"

import { auth } from "@/lib/auth/auth"
import { isStaff } from "@/lib/rbac/roles"
import { API_BASE } from "@/lib/api/client"

const ALLOW = new Set(["admin", "products", "categories", "brands", "tags"])

async function handle(req: NextRequest, segments: string[]) {
  if (!segments.length || !ALLOW.has(segments[0])) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_PATH", message: "path not allowed" } },
      { status: 403 }
    )
  }

  const session = await auth()
  if (!session?.user || !isStaff(session.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "staff access required" } },
      { status: 403 }
    )
  }

  const target = `${API_BASE}/${segments.join("/")}${req.nextUrl.search}`
  const method = req.method
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE"
  const contentType = req.headers.get("content-type") ?? ""
  const isMultipart = contentType.startsWith("multipart/form-data")

  let body: BodyInit | undefined
  const forwardHeaders: Record<string, string> = {
    ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
  }

  if (hasBody) {
    if (isMultipart) {
      // Preserve the multipart payload (and its boundary) untouched.
      body = Buffer.from(await req.arrayBuffer())
      forwardHeaders["Content-Type"] = contentType
    } else {
      const text = await req.text()
      if (text) {
        body = text
        forwardHeaders["Content-Type"] = "application/json"
      }
    }
  }

  let res: Response
  try {
    res = await fetch(target, { method, headers: forwardHeaders, body, cache: "no-store" })
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
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path)
}
