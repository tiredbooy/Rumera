/**
 * Authenticated BFF proxy. Client React Query hooks call `/api/store/<path>`;
 * this forwards to `${API}/api/v1/<path>` with the caller's bearer token taken
 * from the next-auth session — so the access token never reaches the browser.
 * The Auth.js route wrapper owns refresh rotation and persists its replacement
 * cookie before this handler returns.
 *
 * A path allowlist limits it to per-user / checkout resources, so it can't be
 * used as an open proxy.
 */
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

import { routeAuth } from "@/lib/auth/auth";
import { buildAdminProxyTarget } from "@/lib/api/admin-proxy-path";
import { API_BASE } from "@/lib/api/client";

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
  if (!session?.user || session.error) {
    return NextResponse.json(
      { error: { code: "SESSION_EXPIRED", message: "sign in required" } },
      { status: 401 },
    );
  }
  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const sendUpstream = (accessToken?: string) =>
    fetch(target.url, {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });

  let res: Response;
  try {
    res = await sendUpstream(session.accessToken);
  } catch {
    return NextResponse.json(
      {
        error: { code: "UPSTREAM_UNAVAILABLE", message: "could not reach API" },
      },
      { status: 502 },
    );
  }

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  // Pass the backend's JSON (and status) through unchanged.
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

const authenticatedHandler = routeAuth(async (req, ctx) => {
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
