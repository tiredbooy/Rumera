"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, ImageOff, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { toAsciiDigits } from "@/lib/normalize-digits";
import { cn } from "@/lib/utils";
import type {
  Brand,
  CreateBrandInput,
} from "@/features/catalog/brands/types";
import {
  BrandApiError,
  createBrand,
  updateBrand,
  deleteBrand,
} from "@/features/admin/brands/client";
import {
  BRAND_CURRENT_YEAR,
  brandFormSchema,
  type BrandFormValues,
} from "@/features/catalog/brands/validations";
import { BRANDS_QUERY_KEY } from "@/features/admin/brands/components/BrandsTable";

// ── Validation (string fields coerced to the API shape on submit) ─────────────

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
const numOrNull = (v?: string) => {
  if (!v) return null;
  const n = toAsciiDigits(v).trim();
  return n !== "" ? Number(n) : null;
};

function defaults(brand?: Brand): BrandFormValues {
  return {
    title: brand?.title ?? "",
    slug: brand?.slug ?? "",
    country: brand?.country ?? "",
    founded_year: brand?.founded_year != null ? String(brand.founded_year) : "",
    image_url: brand?.image_url ?? "",
    description: brand?.description ?? "",
  };
}

// ── Layout helpers (mirror product-form) ──────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
  full,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children as React.ReactElement}
      </FieldControl>
      {error ? (
        <p id={fieldErrorId(id)} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={fieldDescriptionId(id)} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Live logo preview ─────────────────────────────────────────────────────────

function LogoPreview({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = React.useState(false);
  const [lastUrl, setLastUrl] = React.useState(url);
  const trimmed = url.trim();
  const valid = /^https?:\/\/.+/i.test(trimmed);

  // Reset the error state when the URL changes (adjust-state-during-render).
  if (url !== lastUrl) {
    setLastUrl(url);
    setFailed(false);
  }

  return (
    <span className="relative mx-auto flex aspect-square w-32 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/[0.04]">
      {valid && !failed ? (
        <Image
          src={trimmed}
          alt={title ? `لوگوی ${title}` : "پیش‌نمایش لوگوی برند"}
          fill
          sizes="128px"
          unoptimized
          className="object-contain p-3"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex flex-col items-center gap-1.5 text-muted-foreground"
          role="img"
          aria-label="بدون لوگو"
        >
          {failed ? (
            <ImageOff className="size-6 opacity-70" aria-hidden />
          ) : (
            <Tag className="size-6 opacity-70" aria-hidden />
          )}
          <span className="text-[0.65rem]">
            {failed ? "بارگذاری نشد" : "بدون لوگو"}
          </span>
        </span>
      )}
    </span>
  );
}

export function BrandForm({
  mode,
  brand,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit";
  brand?: Brand;
  submitLabel?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: defaults(brand),
  });

  const title = useWatch({ control, name: "title" });
  const imageUrl = useWatch({ control, name: "image_url" });
  const country = useWatch({ control, name: "country" });

  function toPayload(v: BrandFormValues): CreateBrandInput {
    return {
      title: v.title.trim(),
      slug: strOrNull(v.slug),
      country: strOrNull(v.country),
      founded_year: numOrNull(v.founded_year),
      image_url: strOrNull(v.image_url),
      description: strOrNull(v.description),
    };
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof BrandApiError) {
      if (e.fields) {
        Object.entries(e.fields).forEach(([key, msgs], index) => {
          setError(
            key as keyof BrandFormValues,
            { message: msgs[0] },
            { shouldFocus: index === 0 },
          );
        });
      }
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  async function onSubmit(v: BrandFormValues) {
    try {
      if (mode === "create") {
        await createBrand(toPayload(v));
        await queryClient.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
        toast.success("برند ایجاد شد");
        guard.release();
        router.push("/admin/brands");
        router.refresh();
      } else if (brand) {
        await updateBrand(brand.id, toPayload(v));
        await queryClient.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
        toast.success("تغییرات ذخیره شد");
        guard.release();
        router.push("/admin/brands");
        router.refresh();
      }
    } catch (e) {
      applyServerErrors(e);
    }
  }

  async function onDelete() {
    if (!brand) return;
    setIsDeleting(true);
    try {
      await deleteBrand(brand.id);
      await queryClient.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
      toast.success("برند حذف شد");
      guard.release();
      router.push("/admin/brands");
      router.refresh();
    } catch (e) {
      setIsDeleting(false);
      if (e instanceof BrandApiError) {
        toast.error(e.message);
      } else {
        toast.error("حذف برند ناموفق بود");
      }
    }
  }

  const busy = isSubmitting || isDeleting;
  const guard = useUnsavedChangesGuard({ enabled: isDirty, isSaving: busy });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <div className="flex flex-col gap-6">
        <Section
          title="اطلاعات برند"
          description="نام برند الزامی است؛ سایر فیلدها اختیاری‌اند."
        >
          <Field id="title" label="نام برند" error={errors.title?.message} full>
            <Input
              id="title"
              autoComplete="off"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
          </Field>
          <Field
            id="slug"
            label="شناسهٔ نشانی"
            error={errors.slug?.message}
            hint="مثلاً jack-daniel؛ اگر خالی باشد از نام برند ساخته می‌شود."
            full
          >
            <Input
              id="slug"
              dir="ltr"
              autoComplete="off"
              placeholder="jack-daniel"
              aria-invalid={!!errors.slug}
              {...register("slug")}
            />
          </Field>
          <Field
            id="country"
            label="کشور سازنده"
            error={errors.country?.message}
            hint="مثلاً اسکاتلند، فرانسه"
          >
            <Input id="country" autoComplete="off" {...register("country")} />
          </Field>
          <Field
            id="founded_year"
            label="سال تأسیس"
            error={errors.founded_year?.message}
          >
            <Input
              id="founded_year"
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={1000}
              max={BRAND_CURRENT_YEAR}
              placeholder="1887"
              aria-invalid={!!errors.founded_year}
              {...register("founded_year")}
            />
          </Field>
          <Field
            id="image_url"
            label="نشانی لوگو (URL)"
            error={errors.image_url?.message}
            hint="یک نشانی کامل تصویر؛ پیش‌نمایش در کنار فرم نمایش داده می‌شود."
            full
          >
            <Input
              id="image_url"
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder="https://example.com/logo.png"
              aria-invalid={!!errors.image_url}
              {...register("image_url")}
            />
          </Field>
          <Field
            id="description"
            label="توضیحات"
            error={errors.description?.message}
            full
          >
            <Textarea
              id="description"
              rows={4}
              placeholder="معرفی کوتاه برند…"
              {...register("description")}
            />
          </Field>
        </Section>

        {mode === "edit" && brand ? (
          <fieldset className="border-hairline rounded-2xl bg-destructive/[0.03] p-5 ring-1 ring-destructive/15 sm:p-6">
            <legend className="px-1 font-serif text-base text-destructive">
              حذف برند
            </legend>
            <p className="mt-2 text-xs text-muted-foreground">
              با حذف برند، ارتباط آن از محصولات برداشته می‌شود. این عمل قابل
              بازگشت نیست.
            </p>
            <div className="mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                  >
                    <Trash2 className="size-4" /> حذف این برند
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف برند</AlertDialogTitle>
                    <AlertDialogDescription>
                      آیا از حذف «{brand.title}» مطمئن هستید؟ این عمل قابل
                      بازگشت نیست.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      انصراف
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void onDelete();
                      }}
                      disabled={isDeleting}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      حذف برند
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </fieldset>
        ) : null}
      </div>

      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/[0.04]">
            <p className="mb-4 text-xs font-medium text-muted-foreground">
              پیش‌نمایش
            </p>
            <LogoPreview url={imageUrl} title={title} />
            <p className="mt-4 font-medium">{title || "نام برند"}</p>
            <p className="text-xs text-muted-foreground">
              {country || "کشور سازنده"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={busy}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => guard.requestNavigation("/admin/brands")}
            >
              انصراف
            </Button>
          </div>
        </div>
      </aside>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
