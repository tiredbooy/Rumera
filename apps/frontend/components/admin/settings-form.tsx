"use client"

import { Store, Truck, CreditCard, Bell } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-hairline max-w-2xl overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
      {title ? (
        <div className="border-b border-border/50 bg-muted/20 px-6 py-3.5">
          <p className="font-serif text-base">{title}</p>
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </div>
  )
}

function Toggle({
  label,
  description,
  defaultChecked,
}: {
  label: string
  description: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}

export function SettingsForm() {
  function save(section: string) {
    return (e: React.FormEvent) => {
      e.preventDefault()
      toast.success(`تنظیمات ${section} ذخیره شد (نمونه)`)
    }
  }

  return (
    <Tabs defaultValue="store">
      <TabsList>
        <TabsTrigger value="store">
          <Store className="size-4" /> فروشگاه
        </TabsTrigger>
        <TabsTrigger value="shipping">
          <Truck className="size-4" /> ارسال
        </TabsTrigger>
        <TabsTrigger value="payments">
          <CreditCard className="size-4" /> پرداخت
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell className="size-4" /> اعلان‌ها
        </TabsTrigger>
      </TabsList>

      <TabsContent value="store" className="mt-5">
        <Panel title="اطلاعات فروشگاه">
          <form onSubmit={save("فروشگاه")} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="store_name">نام فروشگاه</Label>
              <Input id="store_name" defaultValue="رومرا" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="support_email">ایمیل پشتیبانی</Label>
              <Input id="support_email" type="email" dir="ltr" defaultValue="support@rumera.example" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">تلفن تماس</Label>
              <Input id="phone" dir="ltr" defaultValue="۰۲۱۹۱۰۰۲۰۰۰" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">واحد پول</Label>
              <select id="currency" defaultValue="toman" className={selectCls}>
                <option value="toman">تومان</option>
                <option value="rial">ریال</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="address">نشانی فروشگاه</Label>
              <Textarea id="address" rows={2} defaultValue="تهران، خیابان ولیعصر، پلاک ۱۰۰" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">ذخیرهٔ تنظیمات</Button>
            </div>
          </form>
        </Panel>
      </TabsContent>

      <TabsContent value="shipping" className="mt-5">
        <Panel title="قوانین ارسال">
          <form onSubmit={save("ارسال")} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="free_shipping">آستانهٔ ارسال رایگان (تومان)</Label>
              <Input id="free_shipping" type="number" dir="ltr" defaultValue={5_000_000} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="flat_rate">هزینهٔ ارسال پایه (تومان)</Label>
              <Input id="flat_rate" type="number" dir="ltr" defaultValue={350_000} />
            </div>
            <div className="sm:col-span-2">
              <Toggle label="ارسال فوری" description="امکان انتخاب ارسال فوری در پرداخت." defaultChecked />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">ذخیرهٔ تنظیمات</Button>
            </div>
          </form>
        </Panel>
      </TabsContent>

      <TabsContent value="payments" className="mt-5">
        <Panel title="درگاه‌های پرداخت">
          <form onSubmit={save("پرداخت")}>
            <div className="divide-y divide-border/60">
              <Toggle label="درگاه زرین‌پال" description="پرداخت آنلاین از طریق زرین‌پال." defaultChecked />
              <Toggle label="درگاه مستقیم بانکی" description="اتصال به درگاه بانک ملت." />
              <Toggle label="پرداخت با کیف پول" description="استفاده از موجودی کیف پول مشتری." defaultChecked />
            </div>
            <div className="mt-5">
              <Button type="submit">ذخیرهٔ تنظیمات</Button>
            </div>
          </form>
        </Panel>
      </TabsContent>

      <TabsContent value="notifications" className="mt-5">
        <Panel title="اعلان‌ها و هشدارها">
          <form onSubmit={save("اعلان‌ها")}>
            <div className="divide-y divide-border/60">
              <Toggle label="ایمیل سفارش جدید" description="ارسال ایمیل به مدیر هنگام ثبت سفارش." defaultChecked />
              <Toggle label="پیامک به مشتری" description="اطلاع‌رسانی وضعیت سفارش با پیامک." defaultChecked />
              <Toggle label="هشدار کسری موجودی" description="اعلان هنگام رسیدن موجودی به آستانه." defaultChecked />
              <Toggle label="گزارش هفتگی فروش" description="ارسال خلاصهٔ عملکرد در پایان هفته." />
            </div>
            <div className="mt-5">
              <Button type="submit">ذخیرهٔ تنظیمات</Button>
            </div>
          </form>
        </Panel>
      </TabsContent>
    </Tabs>
  )
}
