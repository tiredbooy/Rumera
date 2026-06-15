import { ImagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Bottle } from "@/components/bottle"
import { categories, categoryFa, badgeFa, type Product } from "@/lib/products"

/**
 * Product create/edit form. Presentational scaffold (server-rendered, native
 * controls) with a live bottle preview. Wire the `action` to
 * `POST /api/v1/admin/products` or `PATCH /admin/products/{id}` and add
 * react-hook-form + zod validation as the follow-up — the field names already
 * match the `Product` shape.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
      <legend className="px-1 font-serif text-lg">{title}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  id,
  label,
  children,
  full,
}: {
  id: string
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 outline-none"

export function ProductForm({
  product,
  submitLabel = "ذخیره",
}: {
  product?: Product
  submitLabel?: string
}) {
  const preview = product ?? ({ id: "preview", maker: "" } as Product)

  return (
    <form className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-6">
        <Section title="اطلاعات کلی">
          <Field id="name" label="نام محصول" full>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </Field>
          <Field id="slug" label="نامک (انگلیسی)">
            <Input id="slug" name="slug" dir="ltr" defaultValue={product?.slug} placeholder="aobane-18-year" />
          </Field>
          <Field id="maker" label="سازنده">
            <Input id="maker" name="maker" defaultValue={product?.maker} />
          </Field>
          <Field id="category" label="دسته">
            <select id="category" name="category" defaultValue={product?.category} className={selectCls}>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {categoryFa[c.name]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="origin" label="خاستگاه">
            <Input id="origin" name="origin" defaultValue={product?.origin} placeholder="آیلا، اسکاتلند" />
          </Field>
          <Field id="note" label="نُت چشایی / توضیح کوتاه" full>
            <Textarea id="note" name="note" rows={3} defaultValue={product?.note} />
          </Field>
        </Section>

        <Section title="قیمت‌گذاری و موجودی">
          <Field id="price" label="قیمت (تومان)">
            <Input id="price" name="price" type="number" dir="ltr" defaultValue={product?.price} required />
          </Field>
          <Field id="compareAt" label="قیمت پیش از تخفیف (تومان)">
            <Input id="compareAt" name="compareAt" type="number" dir="ltr" defaultValue={product?.compareAt} />
          </Field>
          <Field id="stock" label="موجودی انبار">
            <Input id="stock" name="stock" type="number" dir="ltr" defaultValue={20} />
          </Field>
          <Field id="badge" label="برچسب">
            <select id="badge" name="badge" defaultValue={product?.badge ?? ""} className={selectCls}>
              <option value="">بدون برچسب</option>
              {(Object.keys(badgeFa) as (keyof typeof badgeFa)[]).map((b) => (
                <option key={b} value={b}>
                  {badgeFa[b]}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="مشخصات">
          <Field id="abv" label="درصد الکل">
            <Input id="abv" name="abv" type="number" step="0.1" dir="ltr" defaultValue={product?.abv} />
          </Field>
          <Field id="volumeMl" label="حجم (میلی‌لیتر)">
            <Input id="volumeMl" name="volumeMl" type="number" dir="ltr" defaultValue={product?.volumeMl} />
          </Field>
        </Section>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/5">
          <p className="mb-4 text-sm text-muted-foreground">پیش‌نمایش</p>
          <span className="mx-auto flex h-40 w-24 items-end justify-center">
            <Bottle product={preview} className="h-40" />
          </span>
          <p className="mt-4 font-medium">{product?.name ?? "نام محصول"}</p>
          <p className="text-xs text-muted-foreground">{product?.maker ?? "سازنده"}</p>
        </div>

        <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
          <p className="mb-3 text-sm font-medium">تصویر محصول</p>
          {/* TODO(api): wire to uploadthing (multi-image + reorder). */}
          <label
            htmlFor="image"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <ImagePlus className="size-6" />
            <span className="text-xs">برای بارگذاری کلیک کنید</span>
            <span className="text-[11px]">۱۰۰۰×۱۲۵۰ پیکسل، JPG/WebP</span>
          </label>
          <input id="image" name="image" type="file" accept="image/*" className="sr-only" />
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit">{submitLabel}</Button>
          <Button type="reset" variant="outline">
            انصراف
          </Button>
        </div>
      </aside>
    </form>
  )
}
