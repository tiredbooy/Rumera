/**
 * Edge-safe auth config — the slice of next-auth that the edge proxy can run on
 * the Edge runtime. It contains NO Node-only code (no `fetch` to the backend, no
 * Buffer): just the session-shaping callback and page routes. The Credentials
 * provider and token-refresh logic live in `auth.ts`, which runs in Node.
 *
 * This is the standard next-auth v5 "split config" pattern.
 */
import type { NextAuthConfig } from "next-auth";

import { permissionsForRole, type Role } from "@/lib/rbac/roles";

import "./types";

export const authConfig = {
  // The login page lives at app/(auth)/login — the (auth) route group adds NO
  // URL segment, so the canonical path is "/login" (this matches proxy.ts,
  // robots.ts, and every in-app link). Keep these in lock-step.
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * Project the token onto the session. Frontend capability identifiers are
     * derived here; only `admin` receives them. Runs in Edge and Node.
     */
    session({ session, token }) {
      const role = (token.role as Role) ?? "customer";
      session.role = role;
      session.permissions = permissionsForRole(role);
      session.accessToken = token.accessToken;
      if (token.user?.id) session.user.id = token.user.id;
      if (token.error) session.error = token.error;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  providers: [],
} satisfies NextAuthConfig;
