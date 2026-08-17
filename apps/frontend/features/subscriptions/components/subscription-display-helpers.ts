import type { Address } from "@/features/addresses/types";
import type {
  Subscription,
  SubscriptionAction,
  SubscriptionStatus,
} from "@/features/subscriptions/types";
import { faNum } from "@/lib/products";

const planFa: Record<string, string> = { "cellar-box": "باکس سرداب" };

const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});

export const cadenceShort: Record<Subscription["cadence"], string> = {
  monthly: "دورهٔ ماهانه",
  quarterly: "دورهٔ فصلی",
};

export function planName(plan: string): string {
  return planFa[plan] ?? "باکس دوره‌ای";
}

export function faDate(iso: string): string {
  try {
    return faDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Human cadence, e.g. «هر ۳۰ روز» / «هر ۳ ماه» — built with Persian digits. */
export function cadenceLabel(cadence: Subscription["cadence"]): string {
  return cadence === "quarterly" ? `هر ${faNum(3)} ماه` : `هر ${faNum(30)} روز`;
}

export function formatAddress(address: Address): string {
  const parts = [
    address.state_province,
    address.city,
    address.address_line1,
  ].filter(Boolean);
  return parts.join("، ");
}

/** Card/header label for the next box window (not a payment invoice). */
export function nextShipTitle(status: SubscriptionStatus): string {
  switch (status) {
    case "paused":
      return "تاریخ نگه‌داشته‌شده";
    case "cancelled":
      return "تاریخ قبلی (لغو شده)";
    default:
      return "ارسال باکس بعدی";
  }
}

/** Secondary line under the next date — honest about email reminder, not charge. */
export function nextShipHint(status: SubscriptionStatus): string {
  switch (status) {
    case "active":
      return "در این تاریخ برای ارسال باکس به شما ایمیل یادآوری می‌فرستیم. پرداخت خودکار انجام نمی‌شود.";
    case "paused":
      return "تا از سر گرفتن، باکسی فرستاده نمی‌شود و ایمیل تمدید نمی‌آید.";
    case "cancelled":
      return "این اشتراک لغو شده؛ برای دریافت باکس دوباره فعال کنید.";
    default:
      return "";
  }
}

export type StatusMeta = {
  label: string;
  explain: string;
};

/** Plain-language status copy (box shipment, not streaming). */
export function statusCopy(status: SubscriptionStatus): StatusMeta {
  switch (status) {
    case "active":
      return {
        label: "فعال",
        explain:
          "باکس شما فعال است. در تاریخ «ارسال باکس بعدی» یادآوری می‌گیرید و تیم فروشگاه ارسال را پیگیری می‌کند.",
      };
    case "paused":
      return {
        label: "متوقف‌شده",
        explain:
          "ارسال موقتاً متوقف است. هیچ باکسی فرستاده نمی‌شود تا «از سر گرفتن» را بزنید. تاریخ بعدی حفظ می‌شود.",
      };
    case "cancelled":
      return {
        label: "لغوشده",
        explain:
          "این اشتراک لغو شده و باکسی ارسال نمی‌شود. با «فعال‌سازی مجدد» می‌توانید دوباره شروع کنید.",
      };
  }
}

/** Active and paused boxes can set/change ship-to; cancelled is read-only. */
export function canChangeShipTo(status: SubscriptionStatus): boolean {
  return status === "active" || status === "paused";
}

/** Amber callout when the box has no resolved address book row. */
export function missingShipToMessage(hasAddressBook: boolean): string {
  return hasAddressBook
    ? "آدرسی به این باکس وصل نیست. یک آدرس از دفترچه انتخاب کنید."
    : "آدرسی به این باکس وصل نیست. از بخش آدرس‌ها یک آدرس اضافه کنید.";
}

/** Toast after a successful address-only PATCH. */
export function addressChangeSuccessMessage(): string {
  return "آدرس ارسال به‌روز شد";
}

/** Toast / success line after a lifecycle action. */
export function actionSuccessMessage(action: SubscriptionAction): string {
  switch (action) {
    case "cancel":
      return "اشتراک لغو شد — دیگر باکسی ارسال نمی‌شود";
    case "skip":
      return "این دوره رد شد — تاریخ ارسال باکس بعدی یک دوره جلو رفت";
    case "pause":
      return "اشتراک متوقف شد — تا از سر گرفتن باکسی نمی‌آید";
    case "resume":
      return "اشتراک دوباره فعال شد";
  }
}

/** Confirm-dialog body for pause / skip / cancel. */
export function actionConfirmDescription(
  action: Extract<SubscriptionAction, "pause" | "skip" | "cancel">,
): { title: string; body: string; confirm: string } {
  switch (action) {
    case "pause":
      return {
        title: "توقف موقت ارسال",
        body: "با توقف، تا وقتی دوباره از سر بگیرید باکسی فرستاده نمی‌شود و ایمیل یادآوری تمدید نمی‌آید. تاریخ نگه‌داشته می‌شود؛ هر زمان خواستید از سر بگیرید.",
        confirm: "بله، متوقف شود",
      };
    case "skip":
      return {
        title: "رد کردن این دوره",
        body: "تاریخ «ارسال باکس بعدی» یک دوره (ماهانه یا فصلی) جلو می‌رود. هزینهٔ خودکار کسر نمی‌شود — فقط پنجرهٔ ارسال جابه‌جا می‌شود.",
        confirm: "بله، این دوره رد شود",
      };
    case "cancel":
      return {
        title: "لغو اشتراک باکس",
        body: "با لغو، دیگر هیچ باکسی برایتان ارسال نمی‌شود. هر زمان بخواهید می‌توانید همان اشتراک را دوباره فعال کنید.",
        confirm: "بله، لغو شود",
      };
  }
}
