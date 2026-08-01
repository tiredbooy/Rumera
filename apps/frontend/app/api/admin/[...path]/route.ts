/**
 * Authenticated BFF proxy for the admin dashboard. Client hooks call
 * `/api/admin/<backend-path>`; this forwards to `${API}/api/v1/<backend-path>`
 * with the caller's bearer token from the Auth.js session — so the access token
 * never reaches the browser. `auth()` owns token rotation; this route never
 * consumes refresh tokens independently.
 *
 * `<backend-path>` is the path *after* `/api/v1`, so admin-namespaced endpoints
 * include the `admin/` segment, e.g. the create-product call hits
 * `/api/admin/admin/products`. Read-only catalogue lookups the form needs
 * (`products/:id`, `categories`, `brands`, `tags`) are reached the same way.
 *
 * Two guards keep this from being an open proxy: the caller must have the admin
 * role and the first path segment must be on the allowlist. The backend repeats
 * the admin-role check; it does not authorize these routes per capability.
 *
 * Unlike `/api/store`, this preserves `multipart/form-data` bodies verbatim so
 * image uploads pass through with their boundary intact.
 */
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextAuthRequest } from "next-auth";

import { auth } from "@/lib/auth/auth";
import { getLiveAccount } from "@/lib/auth/live-account";
import { isStaff } from "@/lib/rbac/roles";
import { API_BASE } from "@/lib/api/client";
import { buildAdminProxyTarget } from "@/lib/api/admin-proxy-path";
import { getAdminRevalidationPlan } from "@/lib/admin-revalidation";

const ALLOW = new Set([
  "admin",
  "products",
  "categories",
  "brands",
  "tags",
  "hero-slides",
]);

async function handle(req: NextAuthRequest, segments: string[]) {
  const target = buildAdminProxyTarget(API_BASE, segments, req.nextUrl.search);
  if (!target || !ALLOW.has(target.decodedSegments[0])) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_PATH", message: "path not allowed" } },
      { status: 403 },
    );
  }

  const session = req.auth;
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "sign in required" } },
      { status: 401 },
    );
  }
  if (session.error) {
    return NextResponse.json(
      { error: { code: "SESSION_EXPIRED", message: "sign in required" } },
      { status: 401 },
    );
  }

  const live = await getLiveAccount(session.accessToken);
  if (live.status === "unavailable") {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_CHECK_UNAVAILABLE",
          message: "could not verify admin access",
        },
      },
      { status: 502 },
    );
  }
  if (live.status === "revoked" || !isStaff(live.profile.role)) {
    return NextResponse.json(
      {
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "live admin access required",
        },
      },
      { status: 403 },
    );
  }

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  let body: BodyInit | undefined;
  const forwardHeaders: Record<string, string> = {
    ...(session.accessToken
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {}),
  };

  if (hasBody) {
    if (isMultipart) {
      // Preserve the multipart payload (and its boundary) untouched.
      body = Buffer.from(await req.arrayBuffer());
      forwardHeaders["Content-Type"] = contentType;
    } else {
      const text = await req.text();
      if (text) {
        body = text;
        forwardHeaders["Content-Type"] = "application/json";
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(target.url, {
      method,
      headers: forwardHeaders,
      body,
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return NextResponse.json(
      {
        error: { code: "UPSTREAM_UNAVAILABLE", message: "could not reach API" },
      },
      { status: 502 },
    );
  }

  if (res.ok) {
    try {
      const plan = getAdminRevalidationPlan(
        target.decodedSegments,
        method,
        res.status,
      );
      for (const tag of plan.tags) revalidateTag(tag, { expire: 0 });
      for (const entry of plan.paths) revalidatePath(entry.path, entry.type);
    } catch (error) {
      // The mutation already succeeded upstream; stale-cache cleanup must not
      // turn that success into a misleading client error.
      console.error("admin storefront cache revalidation failed", error);
    }
  }

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

const authenticatedHandler = auth(async (req, ctx) => {
  const path = (await ctx.params).path;
  if (!Array.isArray(path)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN_PATH", message: "path not allowed" } },
      { status: 403 },
    );
  }
  return handle(req, path);
});

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as PATCH,
  authenticatedHandler as PUT,
  authenticatedHandler as DELETE,
};
