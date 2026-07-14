import { RegisterForm } from "@/features/auth/components/register-form"
import { safeCallbackUrl } from "@/features/auth/redirects"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return <RegisterForm callbackUrl={safeCallbackUrl(callbackUrl)} />
}
