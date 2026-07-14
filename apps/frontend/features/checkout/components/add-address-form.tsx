"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateAddress } from "@/features/addresses/api"
import type {
  Address,
  CreateAddressInput,
} from "@/features/addresses/types"

/** Inline new-address form used inside checkout. Calls back with the created address. */
export function AddAddressForm({
  onCreated,
  onCancel,
}: {
  onCreated: (address: Address) => void
  onCancel?: () => void
}) {
  const create = useCreateAddress()
  const [error, setError] = React.useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const f = new FormData(e.currentTarget)
    const input: CreateAddressInput = {
      title: String(f.get("title") ?? "") || undefined,
      full_name: String(f.get("full_name") ?? ""),
      phone_number: String(f.get("phone_number") ?? "") || undefined,
      address_line1: String(f.get("address_line1") ?? ""),
      city: String(f.get("city") ?? ""),
      postal_code: String(f.get("postal_code") ?? ""),
      country: "IR",
      is_default: true,
    }
    create.mutate(input, {
      onSuccess: (addr) => onCreated(addr),
      onError: () => setError("ثبت آدرس ناموفق بود. ورودی‌ها را بررسی کنید."),
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">نام و نام خانوادگی</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone_number">شمارهٔ تماس</Label>
        <Input id="phone_number" name="phone_number" dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="address_line1">نشانی</Label>
        <Input id="address_line1" name="address_line1" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">شهر</Label>
        <Input id="city" name="city" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="postal_code">کد پستی</Label>
        <Input id="postal_code" name="postal_code" dir="ltr" required />
      </div>

      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : null} ذخیرهٔ آدرس
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            انصراف
          </Button>
        ) : null}
      </div>
    </form>
  )
}
