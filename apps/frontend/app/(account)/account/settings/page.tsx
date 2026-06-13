import { getSession } from "@/lib/auth/session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/dashboard/page-header"

export default async function AccountSettingsPage() {
  const session = await getSession()
  const [firstName = "", lastName = ""] = (session?.user?.name ?? "").split(" ")

  return (
    <>
      <PageHeader title="تنظیمات حساب" description="اطلاعات شخصی و امنیت حساب." />

      <form className="border-hairline max-w-2xl rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="first_name">نام</Label>
            <Input id="first_name" name="first_name" defaultValue={firstName} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last_name">نام خانوادگی</Label>
            <Input id="last_name" name="last_name" defaultValue={lastName} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" name="email" type="email" dir="ltr" defaultValue={session?.user?.email ?? ""} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="phone">شمارهٔ تماس</Label>
            <Input id="phone" name="phone" type="tel" dir="ltr" placeholder="09xxxxxxxxx" />
          </div>
        </div>
        <div className="mt-6 flex justify-start">
          {/* Wire to PATCH /api/v1/auth/me */}
          <Button type="submit">ذخیرهٔ تغییرات</Button>
        </div>
      </form>
    </>
  )
}
