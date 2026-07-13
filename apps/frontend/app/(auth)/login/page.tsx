import { LoginTabs } from "@/features/auth/components/login-tabs"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return <LoginTabs callbackUrl={callbackUrl || "/account"} />
}
