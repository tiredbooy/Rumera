import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { categories, categoryFa, type Product } from "@/lib/products"

/**
 * Product create/edit form (presentational scaffold). Wire `action` to
 * POST /api/v1/admin/products or PATCH /admin/products/{id} as a follow-up.
 */
export function ProductForm({
  product,
  submitLabel = "ذخیره",
}: {
  product?: Product
  submitLabel?: string
}) {
  return (
    <form className="border-hairline max-w-3xl rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">نام محصول</Label>
          <Input id="name" name="name" defaultValue={product?.name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maker">سازنده</Label>
          <Input id="maker" name="maker" defaultValue={product?.maker} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">دسته</Label>
          <select
            id="category"
            name="category"
            defaultValue={product?.category}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {categoryFa[c.name]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">قیمت (تومان)</Label>
          <Input id="price" name="price" type="number" dir="ltr" defaultValue={product?.price} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="abv">درصد الکل</Label>
          <Input id="abv" name="abv" type="number" step="0.1" dir="ltr" defaultValue={product?.abv} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="note">توضیح / نُت چشایی</Label>
          <Textarea id="note" name="note" rows={3} defaultValue={product?.note} />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button type="submit">{submitLabel}</Button>
        <Button type="reset" variant="outline">
          انصراف
        </Button>
      </div>
    </form>
  )
}
