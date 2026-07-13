import { RegisterForm } from "@/features/auth/components/register-form"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  return <RegisterForm callbackUrl={callbackUrl || "/account"} />
}
