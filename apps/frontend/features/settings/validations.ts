import { z } from "zod";

import { toAsciiDigits } from "@/lib/normalize-digits";

const emailish = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "ایمیل معتبر وارد کنید",
  });

/** One modular gift packaging / add-on row in the admin editor. */
export const giftOptionFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "شناسه الزامی است")
    .max(64, "حداکثر ۶۴ نویسه")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "شناسه: حروف لاتین کوچک، عدد و _ (با حرف شروع شود)",
    ),
  label: z
    .string()
    .trim()
    .min(1, "عنوان الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  description: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  /** Minor display unit as digit string (تومان). */
  price: z.string().refine(
    (value) => {
      const n = toAsciiDigits(value).trim();
      return n === "" || (/^\d+$/.test(n) && Number(n) >= 0);
    },
    { message: "قیمت نامنفی و صحیح وارد کنید" },
  ),
  enabled: z.boolean(),
});

export type GiftOptionFormValues = z.infer<typeof giftOptionFormSchema>;

export const siteSettingsFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "نام فروشگاه الزامی است")
    .max(255, "حداکثر ۲۵۵ نویسه"),
  tagline: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  logoUrl: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  description: z.string().max(2000, "حداکثر ۲۰۰۰ نویسه"),
  supportEmail: emailish,
  supportPhone: z.string().trim().max(40, "حداکثر ۴۰ نویسه"),
  address: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  workingHours: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  instagram: z.string().trim().max(255),
  telegram: z.string().trim().max(255),
  whatsapp: z.string().trim().max(255),
  twitter: z.string().trim().max(255),
  youtube: z.string().trim().max(255),
  linkedin: z.string().trim().max(255),
  freeThreshold: z.string().refine(
    (value) => {
      const n = toAsciiDigits(value).trim();
      return (
        n === "" ||
        (/^\d+$/.test(n) && Number.isInteger(Number(n)) && Number(n) >= 0)
      );
    },
    { message: "عدد صحیح و نامنفی وارد کنید" },
  ),
  note: z.string().max(1000, "حداکثر ۱۰۰۰ نویسه"),
  defaultTitle: z.string().trim().max(255, "حداکثر ۲۵۵ نویسه"),
  defaultDescription: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  ogImage: z.string().trim().max(2048, "حداکثر ۲۰۴۸ نویسه"),
  keywords: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  enabled: z.boolean(),
  message: z.string().max(500, "حداکثر ۵۰۰ نویسه"),
  giftEnabled: z.boolean(),
  giftMessageEnabled: z.boolean(),
  giftHidePriceEnabled: z.boolean(),
  giftOptions: z
    .array(giftOptionFormSchema)
    .max(30, "حداکثر ۳۰ گزینه")
    .superRefine((options, ctx) => {
      const seen = new Map<string, number>();
      options.forEach((opt, index) => {
        const id = opt.id.trim().toLowerCase();
        if (!id) return;
        const first = seen.get(id);
        if (first !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: "شناسه تکراری است",
            path: [index, "id"],
          });
        } else {
          seen.set(id, index);
        }
      });
    }),
});

export type SiteSettingsFormValues = z.infer<typeof siteSettingsFormSchema>;
