import { redirect } from "next/navigation"

import { LoginTabs } from "@/features/auth/components/login-tabs"
import { safeCallbackUrl } from "@/features/auth/redirects"
import { getSession } from "@/lib/auth/session"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  const returnTo = safeCallbackUrl(callbackUrl)
  const session = await getSession()
  if (session?.user && session.error !== "RefreshAccessTokenError") {
    redirect(returnTo)
  }
  return <LoginTabs callbackUrl={returnTo} />
}
