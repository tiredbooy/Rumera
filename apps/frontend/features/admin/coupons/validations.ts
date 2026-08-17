import { z } from "zod";

import type {
  Coupon,
  CouponApplicability,
  CreateCouponInput,
  DiscountType,
  UpdateCouponInput,
} from "@/features/coupons/types";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";

const discountTypes = ["percentage", "fixed_amount", "free_shipping"] as const;
export const MAX_COUPON_MONEY = 99_999_999.99;
export const MAX_COUPON_USES = 2_147_483_647;

function optionalNumber(value: string): number | undefined {
  const trimmed = toAsciiDigits(value).trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : Number.NaN;
}

function hasCouponMoneyPrecision(value: string): boolean {
  return /^-?(?:\d+|\d*\.\d{1,2})$/.test(toAsciiDigits(value).trim());
}

export function parseIDList(value: string): number[] {
  if (!value.trim()) return [];
  return [
    ...new Set(
      value
        .split(/[،,\s]+/)
        .filter(Boolean)
        .map((token) => parseAsciiNumber(token)),
    ),
  ];
}

function addIssue(
  context: z.RefinementCtx,
  path: keyof CouponFormValues,
  message: string,
) {
  context.addIssue({ code: "custom", path: [path], message });
}

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "کد تخفیف الزامی است")
      .max(64, "حداکثر ۶۴ نویسه"),
    description: z.string(),
    discount_type: z.enum(discountTypes),
    discount_value: z.string(),
    max_discount_amount: z.string(),
    min_order_amount: z.string(),
    max_uses: z.string(),
    max_uses_per_user: z.string(),
    applicability: z.enum(["all", "specific"]),
    product_ids: z.string(),
    category_ids: z.string(),
    is_active: z.boolean(),
    starts_at: z.string().min(1, "زمان شروع الزامی است"),
    expires_at: z.string(),
  })
  .superRefine((values, context) => {
    const discount = optionalNumber(values.discount_value);
    if (values.discount_type === "percentage") {
      if (
        discount === undefined ||
        Number.isNaN(discount) ||
        !hasCouponMoneyPrecision(values.discount_value) ||
        discount < 0 ||
        discount > 100
      ) {
        addIssue(context, "discount_value", "درصد باید عددی بین ۰ تا ۱۰۰ باشد");
      }
    } else if (values.discount_type === "fixed_amount") {
      if (
        discount === undefined ||
        Number.isNaN(discount) ||
        !hasCouponMoneyPrecision(values.discount_value) ||
        discount <= 0 ||
        discount > MAX_COUPON_MONEY
      ) {
        addIssue(
          context,
          "discount_value",
          "مبلغ تخفیف باید بیشتر از صفر باشد",
        );
      }
    } else if (discount !== undefined && discount !== 0) {
      addIssue(
        context,
        "discount_value",
        "برای ارسال رایگان مقدار تخفیف باید صفر باشد",
      );
    }

    const maxDiscount = optionalNumber(values.max_discount_amount);
    if (values.discount_type !== "percentage" && maxDiscount !== undefined) {
      addIssue(
        context,
        "max_discount_amount",
        "سقف تخفیف فقط برای درصد قابل استفاده است",
      );
    } else if (
      maxDiscount !== undefined &&
      (Number.isNaN(maxDiscount) ||
        !hasCouponMoneyPrecision(values.max_discount_amount) ||
        maxDiscount <= 0 ||
        maxDiscount > MAX_COUPON_MONEY)
    ) {
      addIssue(
        context,
        "max_discount_amount",
        "سقف تخفیف باید بیشتر از صفر باشد",
      );
    }

    const minOrder = optionalNumber(values.min_order_amount);
    if (
      minOrder === undefined ||
      Number.isNaN(minOrder) ||
      !hasCouponMoneyPrecision(values.min_order_amount) ||
      minOrder < 0 ||
      minOrder > MAX_COUPON_MONEY
    ) {
      addIssue(
        context,
        "min_order_amount",
        "حداقل سفارش باید صفر یا بیشتر باشد",
      );
    }

    const maxUses = optionalNumber(values.max_uses);
    if (
      maxUses !== undefined &&
      (Number.isNaN(maxUses) ||
        !Number.isInteger(maxUses) ||
        maxUses < 1 ||
        maxUses > MAX_COUPON_USES)
    ) {
      addIssue(context, "max_uses", "تعداد کل باید یک عدد صحیح مثبت باشد");
    }

    const perUser = optionalNumber(values.max_uses_per_user);
    if (
      perUser === undefined ||
      Number.isNaN(perUser) ||
      !Number.isInteger(perUser) ||
      perUser < 1 ||
      perUser > MAX_COUPON_USES
    ) {
      addIssue(
        context,
        "max_uses_per_user",
        "سهم هر کاربر باید یک عدد صحیح مثبت باشد",
      );
    } else if (
      maxUses !== undefined &&
      !Number.isNaN(maxUses) &&
      perUser > maxUses
    ) {
      addIssue(
        context,
        "max_uses_per_user",
        "سهم هر کاربر نمی‌تواند از تعداد کل بیشتر باشد",
      );
    }

    const startsAt = new Date(values.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      addIssue(context, "starts_at", "زمان شروع معتبر نیست");
    }
    if (values.expires_at) {
      const expiresAt = new Date(values.expires_at);
      if (Number.isNaN(expiresAt.getTime())) {
        addIssue(context, "expires_at", "زمان پایان معتبر نیست");
      } else if (!Number.isNaN(startsAt.getTime()) && expiresAt <= startsAt) {
        addIssue(
          context,
          "expires_at",
          "زمان پایان باید بعد از زمان شروع باشد",
        );
      }
    }

    if (values.applicability === "specific") {
      const productIDs = parseIDList(values.product_ids);
      const categoryIDs = parseIDList(values.category_ids);
      const invalidProducts = productIDs.some(
        (id) => !Number.isInteger(id) || id <= 0,
      );
      const invalidCategories = categoryIDs.some(
        (id) => !Number.isInteger(id) || id <= 0,
      );
      if (invalidProducts) {
        addIssue(
          context,
          "product_ids",
          "شناسه‌های محصول باید عدد صحیح مثبت باشند",
        );
      }
      if (invalidCategories) {
        addIssue(
          context,
          "category_ids",
          "شناسه‌های دسته باید عدد صحیح مثبت باشند",
        );
      }
      if (
        !invalidProducts &&
        !invalidCategories &&
        productIDs.length + categoryIDs.length === 0
      ) {
        addIssue(context, "product_ids", "حداقل یک محصول یا دسته وارد کنید");
      }
    }
  });

export type CouponFormValues = z.infer<typeof couponFormSchema>;

function localDateTime(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

function idList(values?: number[]): string {
  return values?.join(", ") ?? "";
}

export function couponFormDefaults(coupon?: Coupon): CouponFormValues {
  return {
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discount_type: coupon?.discount_type ?? "percentage",
    discount_value:
      coupon?.discount_type === "free_shipping"
        ? "0"
        : String(coupon?.discount_value ?? 0),
    max_discount_amount:
      coupon?.discount_type === "percentage" &&
      coupon.max_discount_amount != null
        ? String(coupon.max_discount_amount)
        : "",
    min_order_amount: String(coupon?.min_order_amount ?? 0),
    max_uses: coupon?.max_uses != null ? String(coupon.max_uses) : "",
    max_uses_per_user: String(coupon?.max_uses_per_user ?? 1),
    applicability: coupon?.applicable_to ? "specific" : "all",
    product_ids: idList(coupon?.applicable_to?.product_ids),
    category_ids: idList(coupon?.applicable_to?.category_ids),
    is_active: coupon?.is_active ?? true,
    starts_at: localDateTime(coupon?.starts_at),
    expires_at: coupon?.expires_at ? localDateTime(coupon.expires_at) : "",
  };
}

function applicability(values: CouponFormValues): CouponApplicability | null {
  if (values.applicability === "all") return null;
  const productIDs = parseIDList(values.product_ids);
  const categoryIDs = parseIDList(values.category_ids);
  return {
    ...(productIDs.length ? { product_ids: productIDs } : {}),
    ...(categoryIDs.length ? { category_ids: categoryIDs } : {}),
  };
}

function discountValue(values: CouponFormValues): number {
  return values.discount_type === "free_shipping"
    ? 0
    : parseAsciiNumber(values.discount_value);
}

export function toCreateCouponInput(
  values: CouponFormValues,
): CreateCouponInput {
  return {
    code: values.code.trim().toUpperCase(),
    description: values.description.trim() || null,
    discount_type: values.discount_type as DiscountType,
    discount_value: discountValue(values),
    max_discount_amount:
      values.discount_type === "percentage" && values.max_discount_amount.trim()
        ? parseAsciiNumber(values.max_discount_amount)
        : null,
    min_order_amount: parseAsciiNumber(values.min_order_amount),
    max_uses: values.max_uses.trim()
      ? parseAsciiNumber(values.max_uses)
      : null,
    max_uses_per_user: parseAsciiNumber(values.max_uses_per_user),
    applicable_to: applicability(values),
    is_active: values.is_active,
    starts_at: new Date(values.starts_at).toISOString(),
    expires_at: values.expires_at
      ? new Date(values.expires_at).toISOString()
      : null,
  };
}

export function toUpdateCouponInput(
  values: CouponFormValues,
  coupon?: Coupon,
): UpdateCouponInput {
  const create = toCreateCouponInput(values);
  const update: UpdateCouponInput = {
    description: create.description,
    discount_value: create.discount_value,
    max_discount_amount: create.max_discount_amount,
    min_order_amount: create.min_order_amount,
    max_uses: create.max_uses,
    max_uses_per_user: create.max_uses_per_user,
    applicable_to: create.applicable_to,
    is_active: values.is_active,
    starts_at: new Date(values.starts_at).toISOString(),
    expires_at: create.expires_at,
  };

  if (!coupon) return update;

  const defaults = couponFormDefaults(coupon);
  const patch: UpdateCouponInput = {};
  if (values.description !== defaults.description) {
    patch.description = update.description;
  }
  if (values.discount_value !== defaults.discount_value) {
    patch.discount_value = update.discount_value;
  }
  if (values.max_discount_amount !== defaults.max_discount_amount) {
    patch.max_discount_amount = update.max_discount_amount;
  }
  if (values.min_order_amount !== defaults.min_order_amount) {
    patch.min_order_amount = update.min_order_amount;
  }
  if (values.max_uses !== defaults.max_uses) {
    patch.max_uses = update.max_uses;
  }
  if (values.max_uses_per_user !== defaults.max_uses_per_user) {
    patch.max_uses_per_user = update.max_uses_per_user;
  }
  if (
    values.applicability !== defaults.applicability ||
    values.product_ids !== defaults.product_ids ||
    values.category_ids !== defaults.category_ids
  ) {
    patch.applicable_to = update.applicable_to;
  }
  if (values.is_active !== defaults.is_active) {
    patch.is_active = update.is_active;
  }
  if (values.starts_at !== defaults.starts_at) {
    patch.starts_at = update.starts_at;
  }
  if (values.expires_at !== defaults.expires_at) {
    patch.expires_at = update.expires_at;
  }
  return patch;
}
