/**
 * Module augmentation — teaches next-auth about the extra fields Rumera carries
 * on the JWT, the resolved session, and the `authorize()` return value.
 *
 * `role` rides on the token (set from the Go backend's access JWT); the
 * `permissions` array is derived from it in the session callback (see
 * `lib/rbac/roles.ts`).
 */
import type { DefaultSession } from "next-auth"
import type { Role } from "@/lib/rbac/roles"
import type { Permission } from "@/lib/rbac/permissions"

type RefreshError = "RefreshAccessTokenError"

declare module "next-auth" {
  interface Session {
    role: Role
    permissions: Permission[]
    accessToken?: string
    error?: RefreshError
    user: { id?: string } & DefaultSession["user"]
  }

  /** Shape returned by the Credentials `authorize()` callback. */
  interface User {
    role?: Role
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    role?: Role
    error?: RefreshError
    user?: { id?: string; name?: string | null; email?: string | null }
  }
}
