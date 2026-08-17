/**
 * Module augmentation — teaches next-auth about the extra fields Rumera carries
 * on the JWT, the resolved session, and the `authorize()` return value.
 *
 * `role` rides on the token (set from the Go backend's access JWT). Frontend
 * admin capability identifiers are derived from it in the session callback.
 * The Go access JWT stays on the encrypted Auth.js token only — never on
 * `Session` / `GET /api/auth/session` / `useSession()`.
 */
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/rbac/roles";
import type { Permission } from "@/lib/rbac/permissions";

export type RefreshError = "RefreshAccessTokenError" | "RefreshRequired";

export interface AuthSession {
  role: Role;
  permissions: Permission[];
  error?: RefreshError;
  user: { id?: string } & DefaultSession["user"];
}

export interface AuthenticatedUser {
  role?: Role;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
}

export interface AuthToken extends AuthenticatedUser {
  error?: RefreshError;
  user?: { id?: string; name?: string | null; email?: string | null };
}

declare module "next-auth" {
  interface Session {
    role: AuthSession["role"];
    permissions: AuthSession["permissions"];
    error?: AuthSession["error"];
    user: AuthSession["user"];
  }

  /** Shape returned by the Credentials `authorize()` callback. */
  interface User {
    role?: AuthenticatedUser["role"];
    accessToken?: AuthenticatedUser["accessToken"];
    refreshToken?: AuthenticatedUser["refreshToken"];
    accessTokenExpires?: AuthenticatedUser["accessTokenExpires"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: AuthToken["accessToken"];
    refreshToken?: AuthToken["refreshToken"];
    accessTokenExpires?: AuthToken["accessTokenExpires"];
    role?: AuthToken["role"];
    error?: AuthToken["error"];
    user?: AuthToken["user"];
  }
}
