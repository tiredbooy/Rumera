"use client"

import * as React from "react"
import { useSession } from "next-auth/react"

import { useClaimReferral } from "@/features/referral/hooks"

const KEY = "rumera_ref"

/**
 * ReferralTracker — invisible. Captures a `?ref=CODE` from the landing URL into
 * localStorage, then claims it once the visitor is authenticated. Mounted in the
 * storefront layout so it sees both the public landing and signed-in browsing.
 */
export function ReferralTracker() {
  const { status } = useSession()
  const claim = useClaimReferral()
  const claimed = React.useRef(false)

  // Capture ?ref on first client render.
  React.useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")
      if (ref) localStorage.setItem(KEY, ref.trim())
    } catch {
      /* ignore storage/URL errors */
    }
  }, [])

  // Claim once signed in.
  React.useEffect(() => {
    if (status !== "authenticated" || claimed.current) return
    let code: string | null = null
    try {
      code = localStorage.getItem(KEY)
    } catch {
      /* ignore */
    }
    if (!code) return
    claimed.current = true
    claim.mutate({ code }, {
      onSettled: () => {
        try {
          localStorage.removeItem(KEY)
        } catch {
          /* ignore */
        }
      },
    })
  }, [status, claim])

  return null
}
