import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/dashboard/page-header"

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

  return (
    <>
      <PageHeader title="تنظیمات" description="پیکربندی فروشگاه و ارسال." />

      <form className="border-hairline max-w-2xl rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="store_name">نام فروشگاه</Label>
            <Input id="store_name" name="store_name" defaultValue="رومرا" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="support_email">ایمیل پشتیبانی</Label>
            <Input id="support_email" name="support_email" type="email" dir="ltr" defaultValue="support@rumera.example" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="free_shipping">آستانهٔ ارسال رایگان (تومان)</Label>
            <Input id="free_shipping" name="free_shipping" type="number" dir="ltr" defaultValue={5_000_000} />
          </div>
        </div>
        <div className="mt-6">
          <Button type="submit">ذخیرهٔ تنظیمات</Button>
        </div>
      </form>
    </>
  )
}
