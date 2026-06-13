/**
 * Edge-safe auth config — the slice of next-auth that the middleware can run on
 * the Edge runtime. It contains NO Node-only code (no `fetch` to the backend, no
 * Buffer): just the session-shaping callback and page routes. The Credentials
 * provider and token-refresh logic live in `auth.ts`, which runs in Node.
 *
 * This is the standard next-auth v5 "split config" pattern.
 */
import type { NextAuthConfig } from "next-auth"

import { permissionsForRole, type Role } from "@/lib/rbac/roles"

import "./types"

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * Project the token onto the session. `permissions` is derived from the
     * role here so every consumer (server guards, middleware, client) reads the
     * same resolved set. Runs in both the Edge and Node instances.
     */
    session({ session, token }) {
      const role = (token.role as Role) ?? "customer"
      session.role = role
      session.permissions = permissionsForRole(role)
      session.accessToken = token.accessToken
      if (token.user?.id) session.user.id = token.user.id
      if (token.error) session.error = token.error
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
