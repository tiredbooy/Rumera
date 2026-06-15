import { getSession } from "@/lib/auth/session"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsView } from "@/components/account/settings-view"

export default async function AccountSettingsPage() {
  const session = await getSession()

  return (
    <>
      <PageHeader title="تنظیمات حساب" description="اطلاعات شخصی، امنیت و حریم خصوصی." />
      <SettingsView
        defaultName={session?.user?.name ?? ""}
        defaultEmail={session?.user?.email ?? ""}
      />
    </>
  )
}
