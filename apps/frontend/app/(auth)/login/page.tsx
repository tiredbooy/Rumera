import { LoginTabs } from "@/features/auth/components/login-tabs"
import { safeCallbackUrl } from "@/features/auth/redirects"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return <LoginTabs callbackUrl={safeCallbackUrl(callbackUrl)} />
}
