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
import { getToken } from "next-auth/jwt"

import { auth } from "@/lib/auth/auth"
import { isStaff } from "@/lib/rbac/roles"
import { API_BASE } from "@/lib/api/client"

const ALLOW = new Set(["admin", "products", "categories", "brands", "tags", "hero-slides"])

/**
 * Read the *raw* next-auth JWT (which carries the server-only `refreshToken`)
 * straight from the encrypted session cookie. Unlike `auth()`, this never goes
 * through the session callback, so the refresh token stays server-side. The
 * cookie name / salt are derived from the request protocol so it works in dev,
 * Docker, and prod (where the `__Secure-` prefix is used).
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

/**
 * Exchange the refresh token for a fresh access token via the backend. Returns
 * the new access token, or `undefined` if the refresh failed (in which case the
 * caller should surface the original 401 — the client-side SessionGuard then
 * signs the user out).
 */
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

  const sendUpstream = (headers: Record<string, string>) =>
    fetch(target, { method, headers, body, cache: "no-store" })

  let res: Response
  try {
    res = await sendUpstream(forwardHeaders)

    // The access token may have expired mid-request. Try ONE silent refresh +
    // retry so a transient expiry doesn't surface to the user. If the refresh
    // fails we fall through and return the original 401, and the client-side
    // SessionGuard signs the user out.
    if (res.status === 401) {
      const refreshToken = await readRefreshToken(req)
      if (refreshToken) {
        const fresh = await refreshAccessToken(refreshToken)
        if (fresh) {
          res = await sendUpstream({ ...forwardHeaders, Authorization: `Bearer ${fresh}` })
        }
      }
    }
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
