"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api/user-facing-error";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TagApiError,
  useCreateTag,
  useUpdateTag,
} from "@/features/admin/tags/api";
import {
  normalizeTagSlug,
  tagFormDefaults,
  tagFormSchema,
  toCreateTagInput,
  toUpdateTagInput,
  type TagFormValues,
} from "@/features/admin/tags/validations";
import type { Tag } from "@/features/catalog/tags/types";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactElement;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children}
      </FieldControl>
      {error ? (
        <p
          id={fieldErrorId(id)}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={fieldDescriptionId(id)}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const formFields = new Set<keyof TagFormValues>([
  "title",
  "slug",
  "description",
]);

export function TagForm({ mode, tag }: { mode: "create" | "edit"; tag?: Tag }) {
  const router = useRouter();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag(tag?.id ?? 0);
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tagFormDefaults(tag),
  });

  const title = useWatch({ control, name: "title" });
  const slug = useWatch({ control, name: "slug" });
  const busy = isSubmitting || createTag.isPending || updateTag.isPending;

  React.useEffect(() => {
    if (slugTouched) return;
    setValue("slug", normalizeTagSlug(title), { shouldValidate: false });
  }, [setValue, slugTouched, title]);

  function applyError(error: unknown) {
    if (error instanceof TagApiError) {
      let focused = false;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        if (!formFields.has(key as keyof TagFormValues)) continue;
        setError(
          key as keyof TagFormValues,
          { message: messages[0] },
          { shouldFocus: !focused },
        );
        focused = true;
      }
      const message = apiErrorMessage(error, "ذخیرهٔ برچسب ناموفق بود");
      setFormError(message);
      toast.error(message);
      return;
    }
    setFormError("ذخیرهٔ برچسب ناموفق بود");
    toast.error("ذخیرهٔ برچسب ناموفق بود");
  }

  async function onSubmit(values: TagFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        await createTag.mutateAsync(toCreateTagInput(values));
        toast.success("برچسب ساخته شد");
      } else {
        if (!tag) return;
        await updateTag.mutateAsync(toUpdateTagInput(values));
        toast.success("تغییرات برچسب ذخیره شد");
      }
      router.push("/admin/tags");
      router.refresh();
    } catch (error) {
      applyError(error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-busy={busy || undefined}
      className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        {formError ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
          >
            {formError}
          </p>
        ) : null}

        <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <legend className="px-1 font-serif text-base">اطلاعات برچسب</legend>
          <p className="-mt-0.5 text-xs text-muted-foreground">
            نام و نامک باید در کل کاتالوگ یکتا باشند.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="title" label="نام برچسب" error={errors.title?.message}>
              <Input
                id="title"
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                {...register("title")}
              />
            </Field>
            <Field
              id="slug"
              label="نامک"
              error={errors.slug?.message}
              hint="از نام پیشنهاد می‌شود؛ فارسی و انگلیسی پشتیبانی می‌شوند."
            >
              <Input
                id="slug"
                dir="auto"
                autoComplete="off"
                placeholder="single-malt"
                aria-invalid={errors.slug ? true : undefined}
                {...register("slug", {
                  onChange: () => setSlugTouched(true),
                })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="description"
                label="توضیحات"
                error={errors.description?.message}
                hint="اختیاری؛ برای توضیح کاربرد این برچسب در مدیریت کاتالوگ."
              >
                <Textarea
                  id="description"
                  rows={5}
                  {...register("description")}
                />
              </Field>
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">پیش‌نمایش</p>
          <div className="mt-4 flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hash className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {title.trim() || "نام برچسب"}
              </span>
              <span
                className="block truncate text-xs text-muted-foreground"
                dir="auto"
              >
                {slug || "generated-slug"}
              </span>
            </span>
          </div>
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "create" ? "ساخت برچسب" : "ذخیرهٔ تغییرات"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => router.push("/admin/tags")}
        >
          انصراف
        </Button>
      </aside>
    </form>
  );
}
