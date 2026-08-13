import type { ApiFieldErrors } from "./types";
import { ApiError } from "./errors";
import { ApiClientError } from "./store-client";

/**
 * Structured copy for toasts / inline alerts (PH-012d).
 * Prefer known API codes → Persian; otherwise safe server message; else fallback.
 */
export type UserFacingError = {
  /** Primary line shown to the user (toast title or alert body). */
  title: string;
  /** Optional secondary detail (toast description). */
  description?: string;
  /** Validation map when present. */
  fieldErrors?: ApiFieldErrors;
  code?: string;
  status?: number;
};

type Extracted = {
  status?: number;
  code?: string;
  message?: string;
  fields?: ApiFieldErrors;
};

/** Duck-type extract from ApiError, ApiClientError, and feature-owned error classes. */
export function extractApiError(error: unknown): Extracted {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }
  if (error instanceof ApiClientError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const status = typeof e.status === "number" ? e.status : undefined;
    const code = typeof e.code === "string" ? e.code : undefined;
    const message =
      typeof e.message === "string"
        ? e.message
        : error instanceof Error
          ? error.message
          : undefined;
    const fields =
      e.fields && typeof e.fields === "object"
        ? (e.fields as ApiFieldErrors)
        : undefined;
    if (status != null || code || message) {
      return { status, code, message, fields };
    }
  }
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
  return {};
}

/** High-traffic backend codes → clear Persian (storefront + admin). */
const CODE_COPY: Record<string, { title: string; description?: string }> = {
  OUT_OF_STOCK: {
    title: "موجودی کافی نیست",
    description: "تعداد را کم کنید یا کالا را از سبد حذف کنید.",
  },
  CART_EMPTY: {
    title: "سبد خرید خالی است",
    description: "پیش از ثبت سفارش حداقل یک کالا اضافه کنید.",
  },
  INVALID_SHIPPING_METHOD: {
    title: "روش ارسال نامعتبر است",
    description: "روش دیگری برای آدرس خود انتخاب کنید.",
  },
  INVALID_COUPON: {
    title: "کد تخفیف نامعتبر است",
    description: "املای کد را بررسی کنید یا آن را حذف کنید.",
  },
  COUPON_EXPIRED: {
    title: "کد تخفیف منقضی شده است",
  },
  COUPON_NOT_ACTIVE: {
    title: "کد تخفیف هنوز فعال نشده است",
  },
  ORDER_BELOW_MINIMUM: {
    title: "مبلغ سفارش کمتر از حداقل کد تخفیف است",
    description: "کالاهای بیشتری اضافه کنید یا کد را حذف کنید.",
  },
  COUPON_USAGE_LIMIT: {
    title: "سقف استفاده از این کد تخفیف پر شده است",
  },
  COUPON_USER_LIMIT: {
    title: "شما قبلاً از این کد تخفیف استفاده کرده‌اید",
  },
  INSUFFICIENT_FUNDS: {
    title: "موجودی کیف پول کافی نیست",
    description: "مبلغ را کم کنید یا موجودی را افزایش دهید.",
  },
  INSUFFICIENT_POINTS: {
    title: "امتیاز کافی ندارید",
    description: "امتیاز کمتری وارد کنید یا بعداً دوباره تلاش کنید.",
  },
  GIFT_CARD_INVALID: {
    title: "کد کارت هدیه نامعتبر است",
    description: "کد اشتباه است یا قبلاً استفاده شده.",
  },
  ORDER_NOT_FOUND: { title: "سفارش پیدا نشد" },
  ORDER_ALREADY_PAID: { title: "این سفارش قبلاً پرداخت شده است" },
  ORDER_CANCELLED: { title: "این سفارش لغو شده است" },
  PAYMENT_FAILED: {
    title: "پرداخت ناموفق بود",
    description: "روش دیگری را امتحان کنید یا دوباره تلاش کنید.",
  },
  PRODUCT_NOT_FOUND: { title: "این محصول دیگر در دسترس نیست" },
  PRODUCT_UNAVAILABLE: { title: "این گزینه فعلاً قابل خرید نیست" },
  NOT_FOUND: { title: "مورد درخواستی پیدا نشد" },
  INVALID_CREDENTIALS: {
    title: "ایمیل یا گذرواژه نادرست است",
  },
  ACCOUNT_DISABLED: {
    title: "این حساب غیرفعال است",
    description: "در صورت نیاز با پشتیبانی تماس بگیرید.",
  },
  UNAUTHORIZED: {
    title: "نشست شما منقضی شده است",
    description: "دوباره وارد شوید.",
  },
  SESSION_EXPIRED: {
    title: "نشست شما منقضی شده است",
    description: "دوباره وارد شوید.",
  },
  MISSING_TOKEN: {
    title: "برای ادامه باید وارد شوید",
  },
  INVALID_TOKEN: {
    title: "نشست نامعتبر است",
    description: "دوباره وارد شوید.",
  },
  FORBIDDEN: {
    title: "اجازهٔ انجام این عملیات را ندارید",
  },
  ACCESS_DENIED: {
    title: "دسترسی مجاز نیست",
  },
  INSUFFICIENT_PERMISSIONS: {
    title: "مجوز کافی ندارید",
    description: "از یک مدیر با دسترسی مناسب کمک بگیرید.",
  },
  VALIDATION_ERROR: {
    title: "اطلاعات واردشده نامعتبر است",
  },
  INVALID_BODY: { title: "درخواست نامعتبر است" },
  INVALID_JSON: { title: "درخواست نامعتبر است" },
  INVALID_REQUEST: { title: "درخواست نامعتبر است" },
  CONFLICT: {
    title: "تداخل در ثبت اطلاعات",
    description: "صفحه را تازه کنید و دوباره تلاش کنید.",
  },
  IDEMPOTENCY_CONFLICT: {
    title: "درخواست تکراری با محتوای متفاوت",
    description: "کلید را عوض کنید یا همان بدنه را دوباره بفرستید.",
  },
  IDEMPOTENCY_IN_PROGRESS: {
    title: "درخواست قبلی هنوز در حال پردازش است",
    description: "چند لحظه صبر کنید.",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "ارتباط با سرور برقرار نشد",
    description: "دوباره تلاش کنید.",
  },
  TOO_MANY_REQUESTS: {
    title: "تعداد درخواست‌ها زیاد است",
    description: "کمی صبر کنید و دوباره تلاش کنید.",
  },
  INTERNAL_ERROR: {
    title: "خطای غیرمنتظره رخ داد",
    description: "لطفاً دوباره تلاش کنید.",
  },
};

function isPersian(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function isGenericEnglishMessage(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    m === "" ||
    m === "an unexpected error occurred" ||
    m === "an unknown error occurred" ||
    m === "internal server error" ||
    m === "request failed" ||
    m === "error"
  );
}

export type DescribeApiErrorOptions = {
  /** Used only when code is unknown and message empty/unusable. */
  fallback?: string;
  /**
   * When true (default), known code map wins for title.
   * Server message (if Persian or non-generic English) may fill description.
   */
  preferCodeMap?: boolean;
};

/**
 * Map any thrown API-shaped error to user-facing Persian (or safe server text).
 * Never invent fields; only surface envelope `code` / `message` / `fields`.
 */
export function describeApiError(
  error: unknown,
  options: DescribeApiErrorOptions = {},
): UserFacingError {
  const fallback =
    options.fallback?.trim() || "عملیات ناموفق بود. دوباره تلاش کنید.";
  const preferCodeMap = options.preferCodeMap !== false;
  const extracted = extractApiError(error);
  const code = extracted.code?.trim() || undefined;
  const rawMessage = extracted.message?.trim() || "";
  const hasApiShape = extracted.status != null || Boolean(code);

  // Plain Error / unknown without API envelope: never dump raw English noise.
  if (!hasApiShape) {
    if (rawMessage && isPersian(rawMessage)) {
      return { title: rawMessage };
    }
    return { title: fallback };
  }

  const mapped = code ? CODE_COPY[code] : undefined;

  // Coupon family catch-all when specific code not listed.
  const couponFamily =
    !mapped &&
    code &&
    (code.includes("COUPON") || code === "ORDER_BELOW_MINIMUM")
      ? {
          title: "کد تخفیف معتبر نیست",
          description: "کد را بررسی کنید یا حذف کنید.",
        }
      : undefined;

  const copy = mapped ?? couponFamily;

  let title = fallback;
  let description: string | undefined;

  if (preferCodeMap && copy) {
    title = copy.title;
    description = copy.description;
    // Enrich with safe server detail when useful and not redundant.
    if (
      rawMessage &&
      !isGenericEnglishMessage(rawMessage) &&
      rawMessage !== title &&
      rawMessage !== description
    ) {
      if (isPersian(rawMessage)) {
        description = rawMessage;
      } else if (!description && rawMessage.length <= 160) {
        description = rawMessage;
      }
    }
  } else if (rawMessage && !isGenericEnglishMessage(rawMessage)) {
    if (isPersian(rawMessage) || !copy) {
      title = rawMessage;
    } else {
      title = copy.title;
      description = copy.description;
    }
  } else if (copy) {
    title = copy.title;
    description = copy.description;
  }

  // Validation fields → hint in description if empty.
  if (
    extracted.fields &&
    Object.keys(extracted.fields).length > 0 &&
    !description
  ) {
    description = "فیلدهای مشخص‌شده را اصلاح کنید.";
  }

  return {
    title,
    description,
    fieldErrors: extracted.fields,
    code,
    status: extracted.status,
  };
}

/** Single-line string for simple `toast.error(...)` call sites. */
export function apiErrorMessage(
  error: unknown,
  fallback?: string,
): string {
  // Cart/checkout often want a compact title; description is optional on toast.
  return describeApiError(error, { fallback }).title;
}

/** Toast helper: title + optional description for sonner. */
export function apiErrorToast(
  error: unknown,
  fallback?: string,
): { title: string; description?: string } {
  const d = describeApiError(error, { fallback });
  return { title: d.title, description: d.description };
}
