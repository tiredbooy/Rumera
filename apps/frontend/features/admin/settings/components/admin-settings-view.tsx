import "server-only";

import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { getAdminSiteSettings } from "@/features/settings/api/server";
import { ApiError } from "@/lib/api/errors";

import { SettingsForm } from "./SettingsForm";

const SETTINGS_HEADER = {
  title: "تنظیمات",
  description:
    "پیکربندی فروشگاه، تماس، شبکه‌های اجتماعی، ارسال، سئو و حالت تعمیر.",
} as const;

export async function AdminSettingsView() {
  let settings;
  try {
    settings = await getAdminSiteSettings();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <>
        <PageHeader {...SETTINGS_HEADER} />
        <AdminDataErrorState
          title="بارگذاری تنظیمات ناموفق بود"
          description="هیچ مقدار جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader {...SETTINGS_HEADER} />
      <SettingsForm settings={settings} />
    </>
  );
}
