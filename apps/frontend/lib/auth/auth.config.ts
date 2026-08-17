/**
 * Edge-safe auth config — the slice of next-auth that the edge proxy can run on
 * the Edge runtime. It contains NO Node-only code (no `fetch` to the backend, no
 * Buffer): just the session-shaping callback, page routes, and a getToken helper
 * that reads the encrypted Auth.js JWT. The Credentials provider and
 * token-refresh logic live in `auth.ts`, which runs in Node.
 *
 * This is the standard next-auth v5 "split config" pattern.
 */
import type { NextAuthConfig } from "next-auth";
import { getToken, type JWT } from "next-auth/jwt";

import { permissionsForRole, type Role } from "@/lib/rbac/roles";

import "./types";

type TokenRequest = { headers: Headers | Record<string, string> };

function usesSecureSessionCookie(headers: Headers | Record<string, string>) {
  const cookie =
    headers instanceof Headers
      ? (headers.get("cookie") ?? "")
      : String(headers.cookie ?? headers.Cookie ?? "");
  if (cookie.includes("__Secure-authjs.session-token")) return true;
  if (cookie.includes("authjs.session-token")) return false;
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith(
    "https://",
  );
}

/**
 * Decode the encrypted Auth.js JWT (httpOnly cookie). The Go access token lives
 * here — never on the public Session object that `GET /api/auth/session` returns.
 */
export async function getAuthJwt(req: TokenRequest): Promise<JWT | null> {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: usesSecureSessionCookie(req.headers),
  });
}

export async function getAccessTokenFromJwt(
  req: TokenRequest,
): Promise<string | undefined> {
  const token = await getAuthJwt(req);
  return token?.accessToken;
}

export const authConfig = {
  // The login page lives at app/(auth)/login — the (auth) route group adds NO
  // URL segment, so the canonical path is "/login" (this matches proxy.ts,
  // robots.ts, and every in-app link). Keep these in lock-step.
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * Project public fields onto the session. Frontend capability identifiers
     * are derived here. The Go access JWT stays on the encrypted token only —
     * `useSession()` / `GET /api/auth/session` must never see it. Runs in Edge
     * and Node.
     */
    session({ session, token }) {
      const role = (token.role as Role) ?? "customer";
      session.role = role;
      session.permissions = permissionsForRole(role);
      if (token.user?.id) session.user.id = token.user.id;
      if (token.error) session.error = token.error;
      delete (session as { accessToken?: string }).accessToken;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  providers: [],
} satisfies NextAuthConfig;
