import { z } from "zod";

import type {
  CreateShippingMethodInput,
  CreateShippingZoneInput,
  ShippingMethod,
  ShippingRateType,
  ShippingZone,
  UpdateShippingMethodInput,
  UpdateShippingZoneInput,
} from "./types";

const shippingRateTypes = [
  "flat_rate",
  "per_kg",
  "percentage",
  "free",
] as const;

export const MAX_SHIPPING_MONEY = 99_999_999.99;
export const MAX_SHIPPING_WEIGHT = 999_999.99;
export const MAX_DELIVERY_DAYS = 32_767;

type ShippingMethodRuleField =
  | "base_rate"
  | "free_above_amount"
  | "min_delivery_days"
  | "max_delivery_days"
  | "max_weight_kg";

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : Number.NaN;
}

function hasTwoDecimalScale(value: string): boolean {
  return /^-?(?:\d+|\d*\.\d{1,2})$/.test(value.trim());
}

export function parseRegionCodes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[،,\n]+/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export const shippingZoneFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "نام منطقه الزامی است")
      .max(100, "نام منطقه حداکثر ۱۰۰ نویسه است"),
    description: z.string(),
    region_codes: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    if (parseRegionCodes(values.region_codes).length === 0) {
      context.addIssue({
        code: "custom",
        path: ["region_codes"],
        message: "حداقل یک کد منطقه وارد کنید",
      });
    }
  });

export type ShippingZoneFormValues = z.infer<typeof shippingZoneFormSchema>;

export const shippingMethodFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "نام روش ارسال الزامی است")
      .max(100, "نام روش حداکثر ۱۰۰ نویسه است"),
    carrier: z.string().trim().max(100, "نام حامل حداکثر ۱۰۰ نویسه است"),
    description: z.string(),
    rate_type: z.enum(shippingRateTypes),
    base_rate: z.string(),
    free_above_amount: z.string(),
    min_delivery_days: z.string(),
    max_delivery_days: z.string(),
    max_weight_kg: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    const addIssue = (path: ShippingMethodRuleField, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    const baseRate = optionalNumber(values.base_rate);
    if (
      baseRate === undefined ||
      Number.isNaN(baseRate) ||
      !hasTwoDecimalScale(values.base_rate) ||
      baseRate < 0 ||
      baseRate > MAX_SHIPPING_MONEY
    ) {
      addIssue("base_rate", "نرخ باید عددی نامنفی با حداکثر دو رقم اعشار باشد");
    } else if (values.rate_type === "percentage" && baseRate > 100) {
      addIssue("base_rate", "درصد هزینه نمی‌تواند بیشتر از ۱۰۰ باشد");
    } else if (values.rate_type === "free" && baseRate !== 0) {
      addIssue("base_rate", "نرخ روش رایگان باید صفر باشد");
    }

    const freeAbove = optionalNumber(values.free_above_amount);
    if (values.rate_type === "free" && freeAbove !== undefined) {
      addIssue(
        "free_above_amount",
        "روش همیشه رایگان به آستانهٔ ارسال رایگان نیاز ندارد",
      );
    } else if (
      freeAbove !== undefined &&
      (Number.isNaN(freeAbove) ||
        !hasTwoDecimalScale(values.free_above_amount) ||
        freeAbove <= 0 ||
        freeAbove > MAX_SHIPPING_MONEY)
    ) {
      addIssue(
        "free_above_amount",
        "آستانه باید عددی مثبت با حداکثر دو رقم اعشار باشد",
      );
    }

    const minDays = optionalNumber(values.min_delivery_days);
    const maxDays = optionalNumber(values.max_delivery_days);
    if (
      minDays !== undefined &&
      (Number.isNaN(minDays) ||
        !Number.isInteger(minDays) ||
        minDays < 0 ||
        minDays > MAX_DELIVERY_DAYS)
    ) {
      addIssue("min_delivery_days", "حداقل زمان باید عدد صحیح نامنفی باشد");
    }
    if (
      maxDays !== undefined &&
      (Number.isNaN(maxDays) ||
        !Number.isInteger(maxDays) ||
        maxDays < 0 ||
        maxDays > MAX_DELIVERY_DAYS)
    ) {
      addIssue("max_delivery_days", "حداکثر زمان باید عدد صحیح نامنفی باشد");
    } else if (
      minDays !== undefined &&
      maxDays !== undefined &&
      !Number.isNaN(minDays) &&
      minDays > maxDays
    ) {
      addIssue(
        "max_delivery_days",
        "حداکثر زمان نمی‌تواند کمتر از حداقل زمان باشد",
      );
    }

    const maxWeight = optionalNumber(values.max_weight_kg);
    if (
      maxWeight !== undefined &&
      (Number.isNaN(maxWeight) ||
        !hasTwoDecimalScale(values.max_weight_kg) ||
        maxWeight <= 0 ||
        maxWeight > MAX_SHIPPING_WEIGHT)
    ) {
      addIssue(
        "max_weight_kg",
        "حداکثر وزن باید عددی مثبت با حداکثر دو رقم اعشار باشد",
      );
    }
  });

export type ShippingMethodFormValues = z.infer<typeof shippingMethodFormSchema>;

export function shippingZoneFormDefaults(
  zone?: ShippingZone,
): ShippingZoneFormValues {
  return {
    name: zone?.name ?? "",
    description: zone?.description ?? "",
    region_codes: zone?.region_codes.join("، ") ?? "",
    is_active: zone?.is_active ?? true,
  };
}

export function shippingMethodFormDefaults(
  method?: ShippingMethod,
): ShippingMethodFormValues {
  return {
    name: method?.name ?? "",
    carrier: method?.carrier ?? "",
    description: method?.description ?? "",
    rate_type: method?.rate_type ?? "flat_rate",
    base_rate: String(method?.base_rate ?? 0),
    free_above_amount:
      method?.free_above_amount != null ? String(method.free_above_amount) : "",
    min_delivery_days:
      method?.min_delivery_days != null ? String(method.min_delivery_days) : "",
    max_delivery_days:
      method?.max_delivery_days != null ? String(method.max_delivery_days) : "",
    max_weight_kg:
      method?.max_weight_kg != null ? String(method.max_weight_kg) : "",
    is_active: method?.is_active ?? true,
  };
}

export function toCreateShippingZoneInput(
  values: ShippingZoneFormValues,
): CreateShippingZoneInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    region_codes: parseRegionCodes(values.region_codes),
    is_active: values.is_active,
  };
}

export function toUpdateShippingZoneInput(
  values: ShippingZoneFormValues,
  zone: ShippingZone,
): UpdateShippingZoneInput {
  const next = toCreateShippingZoneInput(values);
  const input: UpdateShippingZoneInput = {};
  if (next.name !== zone.name) input.name = next.name;
  if (next.description !== (zone.description ?? null)) {
    input.description = next.description;
  }
  if (JSON.stringify(next.region_codes) !== JSON.stringify(zone.region_codes)) {
    input.region_codes = next.region_codes;
  }
  if (next.is_active !== zone.is_active)
    input.is_active = next.is_active ?? true;
  return input;
}

export function toCreateShippingMethodInput(
  values: ShippingMethodFormValues,
): CreateShippingMethodInput {
  return {
    name: values.name.trim(),
    carrier: values.carrier.trim() || null,
    description: values.description.trim() || null,
    rate_type: values.rate_type as ShippingRateType,
    base_rate: Number(values.base_rate),
    free_above_amount: values.free_above_amount.trim()
      ? Number(values.free_above_amount)
      : null,
    min_delivery_days: values.min_delivery_days.trim()
      ? Number(values.min_delivery_days)
      : null,
    max_delivery_days: values.max_delivery_days.trim()
      ? Number(values.max_delivery_days)
      : null,
    max_weight_kg: values.max_weight_kg.trim()
      ? Number(values.max_weight_kg)
      : null,
    is_active: values.is_active,
  };
}

export function toUpdateShippingMethodInput(
  values: ShippingMethodFormValues,
  method: ShippingMethod,
): UpdateShippingMethodInput {
  const next = toCreateShippingMethodInput(values);
  const input: UpdateShippingMethodInput = {};
  if (next.name !== method.name) input.name = next.name;
  if (next.carrier !== (method.carrier ?? null)) input.carrier = next.carrier;
  if (next.description !== (method.description ?? null)) {
    input.description = next.description;
  }
  if (next.rate_type !== method.rate_type) input.rate_type = next.rate_type;
  if (next.base_rate !== method.base_rate) {
    input.base_rate = next.base_rate ?? 0;
  }
  if (next.free_above_amount !== (method.free_above_amount ?? null)) {
    input.free_above_amount = next.free_above_amount;
  }
  if (next.min_delivery_days !== (method.min_delivery_days ?? null)) {
    input.min_delivery_days = next.min_delivery_days;
  }
  if (next.max_delivery_days !== (method.max_delivery_days ?? null)) {
    input.max_delivery_days = next.max_delivery_days;
  }
  if (next.max_weight_kg !== (method.max_weight_kg ?? null)) {
    input.max_weight_kg = next.max_weight_kg;
  }
  if (next.is_active !== method.is_active) {
    input.is_active = next.is_active ?? true;
  }
  return input;
}
