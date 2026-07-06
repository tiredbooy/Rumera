import { getSession } from "@/lib/auth/session";
import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { SettingsView } from "@/features/account/settings/components/settings-view";

export default async function AccountSettingsPage() {
  const session = await getSession();

  return (
    <>
      <AccountPageHeader
        eyebrow="پیکربندی"
        title="تنظیمات حساب"
        description="اطلاعات شخصی، امنیت و حریم خصوصی."
      />
      <SettingsView
        defaultName={session?.user?.name ?? ""}
        defaultEmail={session?.user?.email ?? ""}
      />
    </>
  );
}
