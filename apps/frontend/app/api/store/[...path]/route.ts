/**
 * Authenticated BFF proxy. Client React Query hooks call `/api/store/<path>`;
 * this forwards to `${API}/api/v1/<path>` with the caller's bearer token taken
 * from the encrypted Auth.js JWT (`getToken`) — so the access token never
 * reaches the browser or `GET /api/auth/session`.
 * The Auth.js route wrapper owns refresh rotation and persists its replacement
 * cookie before this handler returns. Incoming `Idempotency-Key` is forwarded
 * when present so money retries reach Go middleware; this route never invents
 * a key. Incoming analytics `sid`/`did` cookies are copied upstream and matching
 * Set-Cookie lines are passed back — IDs are never invented here.
 *
 * A path allowlist limits it to per-user / checkout resources, so it can't be
 * used as an open proxy.
 */
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

import { getAccessTokenFromJwt } from "@/lib/auth/auth.config";
import { routeAuth } from "@/lib/auth/auth";
import { buildAdminProxyTarget } from "@/lib/api/admin-proxy-path";
import { API_BASE } from "@/lib/api/client";
import {
  pickAnalyticsCookieHeader,
  pickAnalyticsSetCookies,
  pickIdempotencyKeyHeader,
} from "@/lib/api/forward-headers";

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
  // `payments` covers customer start/status under /payments/* (PR-005a
  // payment_url). First-segment only: /api/store/payments → /api/v1/payments.
  // Admin /admin/payments stays on the admin BFF (`admin` first segment).
  "payments",
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

  const accessToken = await getAccessTokenFromJwt(req);
  const sendUpstream = (bearer?: string) =>
    fetch(target.url, {
      method,
      headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...pickIdempotencyKeyHeader(req.headers),
        ...pickAnalyticsCookieHeader(req.headers),
      },
      body,
      cache: "no-store",
    });

  let res: Response;
  try {
    res = await sendUpstream(accessToken);
  } catch {
    return NextResponse.json(
      {
        error: { code: "UPSTREAM_UNAVAILABLE", message: "could not reach API" },
      },
      { status: 502 },
    );
  }

  if (res.status === 204) return storefrontResponse(res, null);

  // Pass the backend's JSON (and status) through unchanged.
  const text = await res.text();
  return storefrontResponse(res, text);
}

function storefrontResponse(res: Response, body: string | null) {
  const headers = new Headers();
  if (body !== null) {
    headers.set(
      "Content-Type",
      res.headers.get("content-type") ?? "application/json",
    );
  }
  for (const cookie of pickAnalyticsSetCookies(res.headers.getSetCookie())) {
    headers.append("Set-Cookie", cookie);
  }
  return new NextResponse(body, { status: res.status, headers });
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
