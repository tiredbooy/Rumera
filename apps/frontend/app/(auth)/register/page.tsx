import { redirect } from "next/navigation"

import { RegisterForm } from "@/features/auth/components/register-form"
import { safeCallbackUrl } from "@/features/auth/redirects"
import { getSession } from "@/lib/auth/session"

export default async function RegisterPage({
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
  return <RegisterForm callbackUrl={returnTo} />
}
