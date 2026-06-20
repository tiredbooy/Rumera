"use client"

/**
 * SessionGuard — the client-side counterpart to the silent token refresh in
 * `lib/auth/auth.ts`.
 *
 * The JWT callback (`rotate()`) refreshes the access token in the background
 * before it expires; on the rare case where the *refresh* itself fails (refresh
 * token expired/revoked, backend down), it stamps `token.error =
 * 'RefreshAccessTokenError'`, which the session callback projects onto
 * `session.error`. At that point the session is unrecoverable, so we sign the
 * user out cleanly and route them to the canonical login page.
 *
 * Crucially this fires ONLY on that terminal refresh failure — never on a normal
 * still-valid session, and never on a routine access-token expiry (silent
 * refresh handles those transparently). Mounted once under `SessionProvider`
 * (see `app/providers.tsx`), it renders nothing.
 */
import * as React from "react"
import { signOut, useSession } from "next-auth/react"

export function SessionGuard() {
  const { data: session } = useSession()
  const signingOut = React.useRef(false)

  React.useEffect(() => {
    if (session?.error === "RefreshAccessTokenError" && !signingOut.current) {
      // Guard against a double-invoke (Strict Mode / re-render) firing two
      // sign-out requests.
      signingOut.current = true
      void signOut({ callbackUrl: "/login" })
    }
  }, [session?.error])

  return null
}
