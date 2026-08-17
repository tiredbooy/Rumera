"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  FieldControl,
  fieldErrorId,
  getFieldA11yProps,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  Address,
  CreateAddressInput,
} from "@/features/addresses/types"
import {
  addressFormSchema,
  type AddressFormValues,
} from "@/features/addresses/validations"

/** Iranian provinces — static reference data for the address select. */
export const PROVINCES = [
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "اصفهان",
  "البرز",
  "ایلام",
  "بوشهر",
  "تهران",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان رضوی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "فارس",
  "قزوین",
  "قم",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
] as const

export function AddressForm({
  defaultValues,
  submitting,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Address
  submitting: boolean
  onSubmit: (values: CreateAddressInput) => void
  onCancel: () => void
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      full_name: defaultValues?.full_name ?? "",
      phone_number: defaultValues?.phone_number ?? "",
      state_province: defaultValues?.state_province ?? "",
      city: defaultValues?.city ?? "",
      postal_code: defaultValues?.postal_code ?? "",
      address_line1: defaultValues?.address_line1 ?? "",
      address_line2: defaultValues?.address_line2 ?? "",
      is_default: defaultValues?.is_default ?? false,
    },
  })

  const province = useWatch({ control, name: "state_province" })
  const isDefault = useWatch({ control, name: "is_default" })

  function submit(values: AddressFormValues) {
    // ISO 3166-1 alpha-2, not a display name — shipping zones match on the code.
    onSubmit({ ...values, country: defaultValues?.country ?? "IR" })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="title" label="عنوان (اختیاری)" error={errors.title?.message}>
          <Input id="title" placeholder="خانه، محل کار…" {...register("title")} />
        </Field>
        <Field id="full_name" label="نام گیرنده" error={errors.full_name?.message}>
          <Input id="full_name" {...register("full_name")} />
        </Field>
        <Field id="phone_number" label="شمارهٔ تماس" error={errors.phone_number?.message}>
          <Input id="phone_number" type="tel" dir="ltr" placeholder="09xxxxxxxxx" {...register("phone_number")} />
        </Field>
        <Field id="state_province" label="استان" error={errors.state_province?.message}>
          <Select
            value={province || undefined}
            onValueChange={(v) => setValue("state_province", v, { shouldValidate: true })}
          >
            <SelectTrigger
              id="state_province"
              className="w-full"
              {...getFieldA11yProps({
                id: "state_province",
                error: errors.state_province?.message,
              })}
            >
              <SelectValue placeholder="انتخاب استان" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="city" label="شهر" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field id="postal_code" label="کد پستی" error={errors.postal_code?.message}>
          <Input id="postal_code" dir="ltr" inputMode="numeric" maxLength={10} {...register("postal_code")} />
        </Field>
      </div>

      <Field id="address_line1" label="نشانی" error={errors.address_line1?.message}>
        <Textarea id="address_line1" rows={2} {...register("address_line1")} />
      </Field>
      <Field id="address_line2" label="نشانی تکمیلی (اختیاری)" error={errors.address_line2?.message}>
        <Input id="address_line2" placeholder="واحد، طبقه، پلاک…" {...register("address_line2")} />
      </Field>

      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
        <span className="text-sm font-medium">تنظیم به‌عنوان آدرس پیش‌فرض</span>
        <Switch
          checked={!!isDefault}
          onCheckedChange={(v) => setValue("is_default", v)}
          aria-label="آدرس پیش‌فرض"
        />
      </label>

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          انصراف
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          ذخیرهٔ آدرس
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactElement
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error}>{children as React.ReactElement}</FieldControl>
      {error ? (
        <p id={fieldErrorId(id)} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
