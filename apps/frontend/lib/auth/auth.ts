/**
 * Node-runtime next-auth instance: Credentials provider wired to the Go backend
 * (`POST /api/v1/auth/login`) plus the JWT callback that persists the access /
 * refresh token pair and silently rotates it via `POST /auth/refresh` when the
 * access token expires.
 *
 * The access token is a backend-signed JWT; we decode (not verify) its payload
 * to read `role` and `exp` — we trust it because we just received it over the
 * wire from our own API in direct response to a credential exchange.
 */
import NextAuth, { type User } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"

import { authConfig } from "./auth.config"
import type { Role } from "@/lib/rbac/roles"
import "./types"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`

type DecodedAccess = { uid?: number; user_id?: string; role?: string; exp?: number }

function decodeJwt(token: string): DecodedAccess {
  try {
    const payload = token.split(".")[1]
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DecodedAccess
  } catch {
    return {}
  }
}

async function rotate(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) throw new Error("missing refresh token")
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    })
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
    const { data } = await res.json()
    const decoded = decodeJwt(data.access_token)
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: (decoded.exp ?? 0) * 1000,
      role: (decoded.role as Role) ?? token.role,
      error: undefined,
    }
  } catch {
    // Surfaced on the session so the client can force a re-login.
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds): Promise<User | null> {
        if (!creds?.email || !creds?.password) return null
        const res = await fetch(`${BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: creds.email, password: creds.password }),
        })
        if (!res.ok) return null
        const { data } = await res.json()
        if (!data?.access_token) return null
        const decoded = decodeJwt(data.access_token)
        const fullName = [data.user?.first_name, data.user?.last_name]
          .filter(Boolean)
          .join(" ")
        return {
          id: data.user?.user_id ?? decoded.user_id,
          name: fullName || data.user?.email,
          email: data.user?.email,
          role: (data.user?.role ?? decoded.role ?? "customer") as Role,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          accessTokenExpires: (decoded.exp ?? 0) * 1000,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // 1) Initial sign-in — copy the fields off the authorize() return.
      if (user) {
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = user.accessTokenExpires
        token.role = user.role
        token.user = { id: user.id, name: user.name, email: user.email }
        return token
      }
      // 2) Access token still valid (60s clock-skew guard).
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
        return token
      }
      // 3) Expired — rotate against the backend.
      return rotate(token)
    },
  },
})
