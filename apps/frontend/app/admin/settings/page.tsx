import { AlertTriangle } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { serverApi } from "@/lib/api/client"
import type { SiteSettings } from "@/lib/api/admin-client"
import { PageHeader } from "@/components/dashboard/page-header"
import { SettingsForm } from "@/components/admin/settings-form"

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  let settings: SiteSettings | null = null
  let loadError = false
  try {
    settings = await serverApi<SiteSettings>("/admin/settings")
  } catch {
    loadError = true
  }

  return (
    <>
      <PageHeader title="تنظیمات" description="پیکربندی فروشگاه، تماس، شبکه‌های اجتماعی، ارسال، سئو و حالت تعمیر." />
      {loadError || !settings ? (
        <div
          className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
          role="alert"
        >
          <span
            className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertTriangle className="size-6" />
          </span>
          <p className="font-serif text-lg">بارگذاری تنظیمات ناموفق بود</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            ارتباط با سرور برقرار نشد. لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
        </div>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </>
  )
}
