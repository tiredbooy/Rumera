import { z } from "zod";
import { validateImageURL } from "@/features/image-uploader/constants";
import { toAsciiDigits } from "@/lib/normalize-digits";

const imageURL = z
  .string()
  .trim()
  .max(2048, "نشانی تصویر بسیار طولانی است")
  .superRefine((value, context) => {
    const error = validateImageURL(value, {
      allowEmpty: true,
      allowMediaPath: true,
    });
    if (error) context.addIssue({ code: "custom", message: error });
  });

function isValidLocalDateTime(value: string): boolean {
  const localValue = value.trim();
  if (!localValue) return true;
  const date = new Date(localValue);
  return (
    !Number.isNaN(date.getTime()) &&
    heroDateTimeInputValue(date.toISOString()).startsWith(localValue)
  );
}

const optionalLocalDateTime = z
  .string()
  .refine(isValidLocalDateTime, "زمان واردشده معتبر نیست");

function isSafeHeroHref(value: string): boolean {
  const href = value.trim();
  if (!href) return true;
  let decodedHref: string;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return false;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decodedHref)) return false;
  if (href.startsWith("/")) return !decodedHref.startsWith("//");
  if (!/^https:\/\//i.test(href)) return false;

  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" &&
      Boolean(url.host) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

const optionalHeroHref = z
  .string()
  .trim()
  .max(255, "حداکثر ۲۵۵ نویسه")
  .refine(isSafeHeroHref, "نشانی باید مسیر داخلی یا پیوند امن HTTPS باشد");

export function heroDateTimeInputValue(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

export function heroDateTimeISO(value: string): string | null {
  return value.trim() ? new Date(value).toISOString() : null;
}

export const heroSlideFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "عنوان اسلاید الزامی است")
      .max(255, "حداکثر ۲۵۵ نویسه"),
    eyebrow: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    subtitle: z.string(),
    badge: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    image_url: imageURL,
    mobile_image_url: imageURL,
    image_alt: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
    cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    cta_href: optionalHeroHref,
    secondary_cta_label: z.string().trim().max(120, "حداکثر ۱۲۰ نویسه"),
    secondary_cta_href: optionalHeroHref,
    starts_at: optionalLocalDateTime,
    ends_at: optionalLocalDateTime,
    theme: z.enum(["light", "dark"]),
    sort_order: z
      .string()
      .refine(
        (value) => {
          const n = toAsciiDigits(value).trim();
          return (
            n === "" ||
            (!Number.isNaN(Number(n)) && Number.isInteger(Number(n)))
          );
        },
        { message: "عدد صحیح وارد کنید" },
      ),
    is_active: z.boolean(),
    desktop_file_staged: z.boolean(),
  })
  .superRefine((value, context) => {
    const ctaPairs = [
      {
        label: value.cta_label,
        href: value.cta_href,
        labelPath: "cta_label",
        hrefPath: "cta_href",
      },
      {
        label: value.secondary_cta_label,
        href: value.secondary_cta_href,
        labelPath: "secondary_cta_label",
        hrefPath: "secondary_cta_href",
      },
    ] as const;
    for (const pair of ctaPairs) {
      if (Boolean(pair.label.trim()) === Boolean(pair.href.trim())) continue;
      context.addIssue({
        code: "custom",
        path: [pair.label.trim() ? pair.hrefPath : pair.labelPath],
        message: "متن و نشانی دکمه باید با هم تکمیل شوند",
      });
    }

    if (value.starts_at && value.ends_at) {
      const startsAt = new Date(value.starts_at);
      const endsAt = new Date(value.ends_at);
      if (
        !Number.isNaN(startsAt.getTime()) &&
        !Number.isNaN(endsAt.getTime()) &&
        endsAt <= startsAt
      ) {
        context.addIssue({
          code: "custom",
          path: ["ends_at"],
          message: "زمان پایان باید بعد از زمان شروع باشد",
        });
      }
    }

    if (
      value.is_active &&
      value.image_url.trim() === "" &&
      !value.desktop_file_staged
    ) {
      context.addIssue({
        code: "custom",
        path: ["image_url"],
        message: "برای فعال‌سازی، نشانی یا فایل تصویر دسکتاپ الزامی است",
      });
    }
  });

export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>;
