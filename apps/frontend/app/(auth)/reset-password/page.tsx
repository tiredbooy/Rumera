import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <ResetPasswordForm token={token?.trim() ?? ""} />
}
