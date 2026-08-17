"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OptionApiError,
  useCreateOptionType,
  useCreateOptionValue,
  useDeleteOptionValue,
  useUpdateOptionType,
} from "@/features/admin/options/api";
import {
  normalizeOptionTitle,
  optionTypeFormDefaults,
  optionTypeFormSchema,
  optionValueFormSchema,
  type OptionTypeFormValues,
} from "@/features/admin/options/validations";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import { faNum } from "@/lib/products";

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

export function OptionTypeForm({
  mode,
  option,
  canWrite = true,
}: {
  mode: "create" | "edit";
  option?: ProductOptionGroup;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const createType = useCreateOptionType();
  const updateType = useUpdateOptionType(option?.id ?? 0);
  const createValue = useCreateOptionValue(option?.id ?? 0);
  const deleteValue = useDeleteOptionValue(option?.id ?? 0);

  const [titleTouched, setTitleTouched] = React.useState(mode === "edit");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [newValue, setNewValue] = React.useState("");
  const [valueError, setValueError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    value: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OptionTypeFormValues>({
    resolver: zodResolver(optionTypeFormSchema),
    defaultValues: optionTypeFormDefaults(option),
  });

  const displayName = useWatch({ control, name: "display_name" });
  const title = useWatch({ control, name: "title" });
  const busy =
    isSubmitting ||
    createType.isPending ||
    updateType.isPending ||
    createValue.isPending ||
    deleteValue.isPending;
  const editorLocked = busy || !canWrite;

  React.useEffect(() => {
    if (mode === "edit" || titleTouched) return;
    const next = normalizeOptionTitle(displayName ?? "");
    if (next && next !== title) {
      setValue("title", next, { shouldValidate: true });
    }
  }, [displayName, mode, setValue, title, titleTouched]);

  async function onSubmit(values: OptionTypeFormValues) {
    if (!canWrite) return;
    setFormError(null);
    try {
      if (mode === "create") {
        const created = await createType.mutateAsync(values);
        toast.success(`ویژگی «${created.display_name}» ساخته شد`);
        router.push(`/admin/options/${created.id}`);
        router.refresh();
        return;
      }
      await updateType.mutateAsync(values);
      toast.success("ویژگی ذخیره شد");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof OptionApiError
          ? error.message
          : "ذخیرهٔ ویژگی انجام نشد.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function addValue(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setValueError(null);
    const parsed = optionValueFormSchema.safeParse({
      value: newValue,
      sort_order: option?.values.length ?? 0,
    });
    if (!parsed.success) {
      setValueError(parsed.error.issues[0]?.message ?? "مقدار نامعتبر است.");
      return;
    }
    if (!option?.id) return;
    try {
      await createValue.mutateAsync({
        value: parsed.data.value,
        sort_order: parsed.data.sort_order,
      });
      setNewValue("");
      toast.success("مقدار اضافه شد — در همهٔ محصولات قابل انتخاب است");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof OptionApiError
          ? error.message
          : "افزودن مقدار انجام نشد.";
      setValueError(message);
      toast.error(message);
    }
  }

  async function confirmDeleteValue() {
    if (!pendingDelete || !canWrite) return;
    const target = pendingDelete;
    try {
      await deleteValue.mutateAsync(target.id);
      setPendingDelete(null);
      toast.success(`«${target.value}» حذف شد`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof OptionApiError ? error.message : "حذف ناموفق بود",
      );
    }
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!canWrite) {
      event.preventDefault();
      return;
    }
    void handleSubmit(onSubmit)(event);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      {canWrite ? null : (
        <p
          role="status"
          className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/60"
        >
          فقط مشاهده — ذخیره و حذف مقدار به مجوز نوشتن محصول نیاز دارد.
        </p>
      )}
      <form
        onSubmit={onFormSubmit}
        className="border-hairline space-y-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
        noValidate
      >
        <div>
          <h2 className="font-serif text-lg">
            {mode === "create" ? "ویژگی جدید" : "ویرایش ویژگی"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            یک‌بار بسازید و در هر محصولی دوباره استفاده کنید (مثلاً حجم برای همهٔ
            ویسکی‌ها).
          </p>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Field
          id="option-display-name"
          label="نام نمایشی (فارسی)"
          error={errors.display_name?.message}
          hint="مثلاً حجم، رنگ، بسته"
        >
          <Input
            id="option-display-name"
            className="h-11"
            disabled={editorLocked}
            {...register("display_name")}
          />
        </Field>

        <Field
          id="option-title"
          label="کد پایدار (انگلیسی)"
          error={errors.title?.message}
          hint="شناسهٔ فنی یکتا — مثل volume یا color"
        >
          <Input
            id="option-title"
            className="h-11 font-mono"
            dir="ltr"
            disabled={editorLocked}
            {...register("title", {
              onChange: () => setTitleTouched(true),
            })}
          />
        </Field>

        <div className="flex flex-wrap gap-2 pt-2">
          {canWrite ? (
            <Button type="submit" className="h-11" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "create" ? "ساخت ویژگی" : "ذخیره"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="h-11" asChild>
            <Link href="/admin/options">بازگشت</Link>
          </Button>
          {canWrite && mode === "edit" ? (
            <Button type="button" variant="secondary" className="h-11" asChild>
              <Link href="/admin/products/new">استفاده در محصول جدید</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {mode === "edit" && option ? (
        <section
          aria-labelledby="option-values-title"
          className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
        >
          <h2 id="option-values-title" className="font-serif text-lg">
            مقادیر ({faNum(option.values.length)})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            این مقادیر در فرم محصول برای ساخت SKU انتخاب می‌شوند — دوباره نسازید.
          </p>

          <ul className="mt-5 space-y-2">
            {option.values.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                هنوز مقداری نیست. اولین مقدار را پایین اضافه کنید.
              </li>
            ) : (
              option.values.map((value) => (
                <li
                  key={value.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {value.value}
                  </span>
                  <span
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    dir="ltr"
                  >
                    #{value.id}
                  </span>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-destructive"
                      disabled={busy}
                      aria-label={`حذف ${value.value}`}
                      onClick={() =>
                        setPendingDelete({ id: value.id, value: value.value })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          {canWrite ? (
            <form
              onSubmit={addValue}
              className="mt-5 flex flex-col gap-2 sm:flex-row"
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor="new-option-value" className="sr-only">
                  مقدار جدید
                </Label>
                <Input
                  id="new-option-value"
                  className="h-11"
                  placeholder="مثلاً ۷۵۰ میلی‌لیتر"
                  value={newValue}
                  disabled={busy}
                  onChange={(event) => {
                    setNewValue(event.target.value);
                    setValueError(null);
                  }}
                />
                {valueError ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {valueError}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="h-11 shrink-0" disabled={busy}>
                {createValue.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                افزودن مقدار
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteValue.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مقدار؟</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete?.value}» از این ویژگی حذف می‌شود. محصولاتی که این
              مقدار را در تنوع خود دارند ممکن است تنوع ناقص نشان دهند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteValue.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteValue.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteValue();
              }}
            >
              حذف مقدار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
