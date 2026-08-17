import Link from "next/link";
import {
  Send,
  AtSign,
  Camera,
  Play,
  Briefcase,
  MessageCircle,
  ShieldCheck,
  Truck,
  BadgeCheck,
  Phone,
  Mail,
  type LucideIcon,
} from "lucide-react";

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { Button } from "@/components/ui/button";
import { getPublicSiteSettingsOrNull } from "@/features/settings/api/server";
import {
  toStorefrontChromeSettings,
  type ChromeSocialKey,
} from "@/features/storefront/navigation/chrome-settings";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "خرید",
    links: [
      { label: "همهٔ محصولات", href: "/products" },
      { label: "دسته‌بندی‌ها", href: "/categories" },
      { label: "برچسب‌ها", href: "/tags" },
      {
        label: "ارزان‌ترین‌ها",
        href: "/products?sortBy=price&orderBy=asc",
      },
      {
        label: "تازه‌ رسیده‌ها",
        href: "/products?sortBy=created_at&orderBy=desc",
      },
    ],
  },
  {
    title: "کاوش",
    links: [
      { label: "دستورها", href: "/recipes" },
      { label: "ژورنال", href: "/journal" },
      { label: "دربارهٔ ما", href: "/about" },
      { label: "پرسش‌های متداول", href: "/faq" },
    ],
  },
  {
    title: "پشتیبانی",
    links: [
      { label: "حساب کاربری", href: "/account" },
      { label: "پیگیری سفارش", href: "/account/orders" },
      { label: "ارسال و بازگشت کالا", href: "/faq" },
      { label: "تماس با ما", href: "/contact" },
    ],
  },
];

const SOCIAL_ICONS: Record<ChromeSocialKey, LucideIcon> = {
  instagram: Camera,
  telegram: Send,
  whatsapp: MessageCircle,
  twitter: AtSign,
  youtube: Play,
  linkedin: Briefcase,
};

const FALLBACK_FOOTER_BLURB =
  "فروشگاهی منتخب برای هر سلیقه — از نوشیدنی‌های اصل تا لوازم خانه و آشپزخانه، با ضمانت اصالت و ارسالی مطمئن به سراسر کشور.";

const trust = [
  { Icon: ShieldCheck, label: "پرداخت امن" },
  { Icon: BadgeCheck, label: "ضمانت اصالت" },
  { Icon: Truck, label: "ارسال سریع" },
];

export async function SiteFooter() {
  const chrome = toStorefrontChromeSettings(
    await getPublicSiteSettingsOrNull(),
  );
  const { storeName, description, socials, contact } = chrome;
  const hasContact =
    Boolean(contact.supportEmail) ||
    Boolean(contact.supportPhone) ||
    Boolean(contact.workingHours);

  return (
    <footer className="relative border-t border-border/60 bg-card/40">
      {/* Gold hairline crowning the footer — ties it back to the brand foil. */}
      <div aria-hidden className="rule-gold absolute inset-x-0 top-0" />
      <div className="container-px mx-auto max-w-7xl py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* Brand + honest newsletter stub — no subscribe API yet. */}
          <div>
            <RumeraBrandMark
              variant="full"
              size="md"
              href="/"
              aria-label={`${storeName} — خانه`}
            />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              {description ?? FALLBACK_FOOTER_BLURB}
            </p>
            <p className="mt-6 max-w-sm text-sm text-muted-foreground">
              خبرنامه به‌زودی — فعلاً ایمیلی دریافت نمی‌شود.
            </p>
            {socials.length > 0 ? (
              <div className="mt-6 flex items-center gap-2">
                {socials.map(({ key, label, href }) => {
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      size="icon"
                      aria-label={label}
                      asChild
                      className="rounded-full transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon />
                      </a>
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold text-primary">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {hasContact ? (
              <div className="col-span-2 sm:col-span-3">
                <div className="mt-2 flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-8">
                  {contact.supportPhone ? (
                    contact.supportPhone.href ? (
                      <a
                        href={contact.supportPhone.href}
                        dir="ltr"
                        className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                      >
                        <Phone className="size-4 text-primary" />{" "}
                        {contact.supportPhone.value}
                      </a>
                    ) : (
                      <span
                        dir="ltr"
                        className="inline-flex items-center gap-2"
                      >
                        <Phone className="size-4 text-primary" />{" "}
                        {contact.supportPhone.value}
                      </span>
                    )
                  ) : null}
                  {contact.supportEmail ? (
                    <a
                      href={contact.supportEmail.href}
                      dir="ltr"
                      className="inline-flex items-center gap-2 transition-colors hover:text-primary"
                    >
                      <Mail className="size-4 text-primary" />{" "}
                      {contact.supportEmail.value}
                    </a>
                  ) : null}
                  {contact.workingHours ? (
                    <span>{contact.workingHours}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Trust strip */}
        <div className="shadow-e1 mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-border/50 bg-background/50 py-4">
          {trust.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© ۱۴۰۴ {storeName}. تمامی حقوق محفوظ است.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              حریم خصوصی
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              قوانین
            </Link>
            <Link href="/about" className="hover:text-foreground">
              خرید آگاهانه · +۱۸
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
