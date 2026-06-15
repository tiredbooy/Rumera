import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsForm } from "@/components/admin/settings-form"

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  return (
    <>
      <PageHeader title="تنظیمات" description="پیکربندی فروشگاه، ارسال، پرداخت و اعلان‌ها." />
      <SettingsForm />
    </>
  )
}
