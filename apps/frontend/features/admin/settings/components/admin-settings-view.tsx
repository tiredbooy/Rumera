import "server-only";

import { PageHeader } from "@/features/dashboard/components/page-header";
import { getAdminSiteSettings } from "@/features/settings/api/server";

import { SettingsForm } from "./SettingsForm";

export async function AdminSettingsView() {
  const settings = await getAdminSiteSettings();

  return (
    <>
      <PageHeader
        title="تنظیمات"
        description="پیکربندی فروشگاه، تماس، شبکه‌های اجتماعی، ارسال، سئو و حالت تعمیر."
      />
      <SettingsForm settings={settings} />
    </>
  );
}
