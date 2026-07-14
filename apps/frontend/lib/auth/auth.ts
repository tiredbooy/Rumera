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
import {
  authenticateWithOtp,
  authenticateWithPassword,
  AuthServerError,
  refreshAuthTokens,
} from "@/features/auth/api/server"
import type { AccessTokenClaims } from "@/features/auth/types"
import type { Role } from "@/lib/rbac/roles"
import "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

type DecodedAccess = Partial<AccessTokenClaims>

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

    const data = await refreshAuthTokens({ refresh_token: token.refreshToken })
    const decoded = decodeJwt(data.access_token)

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: (decoded.exp ?? 0) * 1000,
      role: (decoded.role as Role) ?? token.role,
      error: undefined,
    }
  } catch (err) {
    console.error("Token rotation failed:", err)
    return { ...token, error: "RefreshAccessTokenError" }
  }
}


export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(creds): Promise<User | null> {
        if (!creds?.email || !creds?.password) return null

        try {
          const data = await authenticateWithPassword({
            email: String(creds.email),
            password: String(creds.password),
          })
          if (!data?.access_token) return null

          const decoded = decodeJwt(data.access_token)

          const fullName = [data.user?.first_name, data.user?.last_name]
            .filter(Boolean)
            .join(" ")

          return {
            id: data.user?.user_id ?? decoded.user_id ?? "",
            name: fullName || data.user?.email,
            email: data.user?.email,
            role: (data.user?.role ?? decoded.role ?? "customer") as Role,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpires: (decoded.exp ?? 0) * 1000,
          }
        } catch (error) {
          if (error instanceof AuthServerError) {
            console.error("Login failed with status:", error.status)
          } else {
            console.error("❌ Authorize fetch error:", error)
          }
          return null
        }
      },
    }),

    // SMS OTP login. The code was already requested via /auth/otp/request; here we
    // exchange (phone, code) for a token pair through /auth/otp/verify.
    Credentials({
      id: "otp",
      credentials: { phone: {}, code: {} },
      async authorize(creds): Promise<User | null> {
        if (!creds?.phone || !creds?.code) return null

        try {
          const data = await authenticateWithOtp({
            phone: String(creds.phone),
            code: String(creds.code),
          })
          if (!data?.access_token) return null

          const decoded = decodeJwt(data.access_token)
          const fullName = [data.user?.first_name, data.user?.last_name]
            .filter(Boolean)
            .join(" ")

          return {
            id: data.user?.user_id ?? decoded.user_id ?? "",
            name: fullName || data.user?.email,
            email: data.user?.email,
            role: (data.user?.role ?? decoded.role ?? "customer") as Role,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpires: (decoded.exp ?? 0) * 1000,
          }
        } catch (error) {
          console.error("❌ OTP authorize fetch error:", error)
          return null
        }
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = user.accessTokenExpires
        token.role = user.role
        token.user = { id: user.id, name: user.name, email: user.email }
        return token
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
        return token
      }

      return rotate(token)
    },
  },
})
