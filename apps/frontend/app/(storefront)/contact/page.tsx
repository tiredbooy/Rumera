import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
} from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { EmptyState } from "@/components/empty-state";
import { getPublicSiteSettings } from "@/features/settings/api/server";
import type { ContactSettings } from "@/features/settings/types";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

import {
  presentContactFields,
  type ContactFieldKey,
} from "./contact-fields";

export const metadata: Metadata = buildMetadata({
  title: "تماس با ما",
  description: "راه‌های ارتباط با پشتیبانی رومرا.",
  path: "/contact",
});

const FIELD_ICONS: Record<ContactFieldKey, typeof Mail> = {
  supportEmail: Mail,
  supportPhone: Phone,
  address: MapPin,
  workingHours: Clock,
};

export default async function ContactPage() {
  let contact: ContactSettings | undefined;
  let loadError = false;

  try {
    const settings = await getPublicSiteSettings();
    contact = settings.contact;
  } catch {
    loadError = true;
  }

  const fields = loadError ? [] : presentContactFields(contact);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "تماس با ما", path: "/contact" },
        ])}
      />

      <section className="container-px mx-auto w-full max-w-3xl py-12 sm:py-16">
        <header className="max-w-2xl">
          <p className="eyebrow mb-3">
            <PhoneCall className="size-3.5" aria-hidden /> پشتیبانی
          </p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            تماس با ما
          </h1>
          <p className="mt-3 text-muted-foreground sm:text-lg">
            {loadError
              ? "فعلاً اطلاعات تماس در دسترس نیست."
              : fields.length
                ? "از راه‌های زیر با پشتیبانی در ارتباط باشید."
                : "هنوز اطلاعات تماسی منتشر نشده است."}
          </p>
        </header>

        {loadError ? (
          <div className="mt-12">
            <EmptyState
              icon={PhoneCall}
              title="بارگذاری اطلاعات تماس ناموفق بود"
              description="بعداً دوباره تلاش کنید یا از پرسش‌های متداول استفاده کنید."
            >
              <Link
                href="/faq"
                className="inline-flex min-h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
              >
                پرسش‌های متداول
              </Link>
            </EmptyState>
          </div>
        ) : fields.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={HelpCircle}
              title="اطلاعات تماسی ثبت نشده"
              description="هنوز ایمیل، تلفن، نشانی یا ساعات کاری در تنظیمات فروشگاه منتشر نشده است."
            />
          </div>
        ) : (
          <ul className="mt-12 space-y-3" aria-label="راه‌های تماس">
            {fields.map((field) => {
              const Icon = FIELD_ICONS[field.key];
              const valueIsLtr =
                field.key === "supportEmail" || field.key === "supportPhone";
              const value = field.href ? (
                <a
                  href={field.href}
                  dir={valueIsLtr ? "ltr" : undefined}
                  className="mt-1 inline-flex min-h-11 items-center text-base font-medium text-foreground transition-colors hover:text-primary"
                >
                  {field.value}
                </a>
              ) : (
                <p
                  dir={valueIsLtr ? "ltr" : undefined}
                  className="mt-1 text-base font-medium text-foreground"
                >
                  {field.value}
                </p>
              );

              return (
                <li key={field.key}>
                  <article className="border-hairline shadow-e1 flex items-start gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm text-muted-foreground">
                        {field.label}
                      </h2>
                      {value}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
