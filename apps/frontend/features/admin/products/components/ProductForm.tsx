"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTransition } from "react";

import type { Brand } from "@/features/catalog/brands/types";

import {
  ProductClientError,
  saveProductAggregate,
} from "@/features/admin/products/api/client";

import type {
  AdminProductDetail,
  ProductOptionGroup,
  SaveProductAggregateInput,
} from "@/features/admin/products/types";

import {
  productFormSchema,
  getDefaultFormValues,
  strOrNull,
  numOrNull,
  parseTags,
  type ProductFormValues,
} from "../validations";

import { FormHeaderBar } from "./product-form/sidebar/FormHeaderBar";
import { MobileActionBar } from "./product-form/sidebar/MobileActionBar";
import { PreviewCard } from "./product-form/sidebar/PreviewCard";
import { GeneralInfoSection } from "./product-form/GeneralInfoSection";
import { SpecificationsSection } from "./product-form/SpecificationsSection";
import { VariantsSection } from "./product-form/VariantsSection";
import { ImagesSection } from "./product-form/ImagesSection";
import { SeoSection } from "./product-form/SeoSection";
import { TagsSection } from "./product-form/TagsSection";
import { UnsavedChangesDialog } from "./product-form/UnsavedChangesDialog";
import type { ProductSavePhase } from "./product-form/sidebar/save-status";
import type { Category } from "@/features/catalog/categories/types";
import type {
  PreparedProductImage,
  ProductImageUploaderHandle,
} from "@/features/image-uploader/types";
import type { ProductGallerySnapshot } from "@/features/image-uploader/product-types";

// ── Payload helpers ─────────────────────────────────────────────

function toAggregatePayload(
  v: ProductFormValues,
  operationId: string,
  expectedUpdatedAt: string | undefined,
  images: PreparedProductImage[],
): SaveProductAggregateInput {
  return {
    operation_id: operationId,
    ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
    title: v.title.trim(),
    code: strOrNull(v.code),
    slug: strOrNull(v.slug),
    category_id: numOrNull(v.category_id),
    description: strOrNull(v.description),
    brand_id: numOrNull(v.brand_id),
    country_of_origin: strOrNull(v.country_of_origin),
    abv: numOrNull(v.abv),
    weight: numOrNull(v.weight),
    is_active: v.is_active,
    meta_title: strOrNull(v.meta_title),
    meta_description: strOrNull(v.meta_description),
    meta_tags: parseTags(v.meta_tags),
    tag_ids: v.tag_ids,
    variants: v.variants.map((variant) => ({
      ...(variant._id ? { id: variant._id } : {}),
      sku: strOrNull(variant.sku),
      price: Number(variant.price),
      compare_at_price: numOrNull(variant.compare_at_price),
      is_active: variant.is_active,
      option_value_ids: variant.option_value_ids,
    })),
    images,
  };
}

function createOperationId() {
  return globalThis.crypto.randomUUID();
}

type PendingAggregateSave = {
  productId: number | null;
  payload: SaveProductAggregateInput;
};

type PendingNavigation = { kind: "route"; href: string } | { kind: "history" };

const HISTORY_GUARD_KEY = "__rumeraProductFormGuard";

function aggregateRecoveryKey(mode: "create" | "edit", productId?: number) {
  return `rumera:product-aggregate:${mode}:${productId ?? "new"}`;
}

// ── Component ────────────────────────────────────────────────────

export function ProductForm({
  mode,
  product,
  categories,
  brands,
  optionTypes = [],
}: {
  mode: "create" | "edit";
  product?: AdminProductDetail;
  categories: Category[];
  brands: Brand[];
  optionTypes?: ProductOptionGroup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savePhase, setSavePhase] = React.useState<ProductSavePhase>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [variantError, setVariantError] = React.useState<string | null>(null);
  const [mediaDirty, setMediaDirty] = React.useState(false);
  const [gallerySnapshot, setGallerySnapshot] =
    React.useState<ProductGallerySnapshot>(() => {
      const primary =
        product?.images?.find((image) => image.is_primary) ??
        product?.images?.[0];
      return {
        count: product?.images?.length ?? 0,
        primaryUrl: primary?.image_url,
      };
    });
  const [hasPendingRetry, setHasPendingRetry] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingNavigation | null>(null);
  const [focusRequest, setFocusRequest] = React.useState<{
    token: number;
    preferredId?: string;
    requireInvalid: boolean;
  } | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const saveErrorRef = React.useRef<HTMLParagraphElement>(null);
  const focusTokenRef = React.useRef(0);
  const uploaderRef = React.useRef<ProductImageUploaderHandle>(null);
  const pendingSaveRef = React.useRef<PendingAggregateSave | null>(null);
  const recoveryTimerRef = React.useRef<number | null>(null);
  const revisionRef = React.useRef(product?.updated_at);
  const historyGuardRef = React.useRef<{
    id: string;
    previousState: unknown;
  } | null>(null);
  const allowHistoryNavigationRef = React.useRef(false);
  const recoveryKey = aggregateRecoveryKey(mode, product?.id);

  const releaseHistoryGuard = React.useCallback(() => {
    const guard = historyGuardRef.current;
    if (!guard) return;
    if (historyGuardID(window.history.state) === guard.id) {
      window.history.replaceState(
        guard.previousState,
        "",
        window.location.href,
      );
    }
    historyGuardRef.current = null;
  }, []);

  const clearPendingSave = React.useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    pendingSaveRef.current = null;
    setHasPendingRetry(false);
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {
      // Saving still works when browser storage is unavailable.
    }
  }, [recoveryKey]);

  React.useEffect(() => {
    try {
      const serialized = sessionStorage.getItem(recoveryKey);
      if (!serialized) return;
      const recovered = JSON.parse(serialized) as PendingAggregateSave;
      if (
        !recovered?.payload?.operation_id ||
        recovered.productId !== (mode === "edit" ? (product?.id ?? null) : null)
      ) {
        sessionStorage.removeItem(recoveryKey);
        return;
      }
      pendingSaveRef.current = recovered;
      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;
        setHasPendingRetry(true);
        setSavePhase("recoverable");
        setSaveError(
          "نتیجهٔ ذخیرهٔ قبلی نامشخص است؛ برای بازیابی، دوباره ذخیره کنید.",
        );
      }, 0);
      return () => {
        if (recoveryTimerRef.current !== null) {
          window.clearTimeout(recoveryTimerRef.current);
          recoveryTimerRef.current = null;
        }
      };
    } catch {
      try {
        sessionStorage.removeItem(recoveryKey);
      } catch {
        // Ignore malformed recovery state when browser storage is unavailable.
      }
    }
  }, [mode, product?.id, recoveryKey]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultFormValues(product),
    shouldFocusError: false,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const title = useWatch({ control, name: "title" });
  const brandId = useWatch({ control, name: "brand_id" });
  const isActive = useWatch({ control, name: "is_active" });
  const brandName = brands.find((b) => String(b.id) === brandId)?.title;
  const hasUnsavedChanges = isDirty || mediaDirty || hasPendingRetry;
  const shouldBlockNavigation = hasUnsavedChanges || isPending;

  const scheduleErrorFocus = React.useCallback(
    (preferredId?: string, requireInvalid = false) => {
      focusTokenRef.current += 1;
      setFocusRequest({
        token: focusTokenRef.current,
        preferredId,
        requireInvalid,
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!focusRequest || isPending) return;
    const timer = window.setTimeout(() => {
      const preferred = focusRequest.preferredId
        ? document.getElementById(focusRequest.preferredId)
        : null;
      const invalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([disabled])',
      );
      if (
        focusRequest.requireInvalid &&
        !invalid &&
        Object.keys(errors).length === 0
      ) {
        return;
      }
      const target = preferred ?? invalid ?? saveErrorRef.current;
      target?.focus();
      target?.scrollIntoView?.({ block: "center" });
      setFocusRequest((current) =>
        current?.token === focusRequest.token ? null : current,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [errors, focusRequest, isPending]);

  React.useEffect(() => {
    if (!shouldBlockNavigation) return;
    const guardUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", guardUnload);
    return () => window.removeEventListener("beforeunload", guardUnload);
  }, [shouldBlockNavigation]);

  React.useEffect(() => {
    if (!shouldBlockNavigation) return;

    const guardLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ kind: "route", href: next });
    };

    document.addEventListener("click", guardLinkNavigation, true);
    return () =>
      document.removeEventListener("click", guardLinkNavigation, true);
  }, [shouldBlockNavigation]);

  React.useEffect(() => {
    if (!shouldBlockNavigation) return;

    let guard = historyGuardRef.current;
    if (!guard) {
      const previousState: unknown = window.history.state;
      guard = { id: createOperationId(), previousState };
      const state =
        previousState && typeof previousState === "object"
          ? { ...previousState, [HISTORY_GUARD_KEY]: guard.id }
          : { [HISTORY_GUARD_KEY]: guard.id };
      try {
        window.history.replaceState(state, "", window.location.href);
        historyGuardRef.current = guard;
      } catch {
        return;
      }
    }

    const guardHistoryNavigation = (event: PopStateEvent) => {
      if (allowHistoryNavigationRef.current) {
        allowHistoryNavigationRef.current = false;
        return;
      }
      if (historyGuardID(event.state) === guard.id) return;
      setPendingNavigation({ kind: "history" });
      window.history.forward();
    };

    window.addEventListener("popstate", guardHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", guardHistoryNavigation);
      if (historyGuardRef.current?.id === guard.id) releaseHistoryGuard();
    };
  }, [releaseHistoryGuard, shouldBlockNavigation]);

  function requestNavigation(destination: string) {
    if (shouldBlockNavigation) {
      setPendingNavigation({ kind: "route", href: destination });
      return;
    }
    router.push(destination);
  }

  function confirmNavigation() {
    if (isPending) return;
    const navigation = pendingNavigation;
    setPendingNavigation(null);
    if (!navigation) return;
    releaseHistoryGuard();
    if (navigation.kind === "route") {
      router.push(navigation.href);
      return;
    }
    allowHistoryNavigationRef.current = true;
    window.history.back();
  }

  function applyServerErrors(e: unknown, preferredFocusId?: string) {
    let message = e instanceof Error ? e.message : "خطای غیرمنتظره رخ داد";
    let hasFieldError = false;
    let sectionFocusId: string | undefined;
    let shouldDiscardPrepared = false;
    if (e instanceof ProductClientError && e.fields) {
      const details = Object.entries(e.fields);
      let firstFieldMessage: string | undefined;
      for (const [path, messages] of details) {
        const rawMessage = messages[0];
        if (!rawMessage) continue;
        const fieldMessage = localizeProductServerError(rawMessage);
        firstFieldMessage ??= fieldMessage;
        if (isProductImagePath(path)) {
          setMediaError(fieldMessage);
          sectionFocusId ??= "product-images-trigger";
          shouldDiscardPrepared ||= rawMessage.includes("staged upload");
          continue;
        }
        if (isProductVariantSectionPath(path)) {
          setVariantError(fieldMessage);
          sectionFocusId ??= "product-variants-trigger";
          continue;
        }
        if (!isProductFormPath(path)) continue;
        hasFieldError = true;
        setError(path as FieldPath<ProductFormValues>, {
          type: "server",
          message: fieldMessage,
        });
      }
      if (firstFieldMessage) message = firstFieldMessage;
    }
    if (shouldDiscardPrepared) uploaderRef.current?.discardPrepared?.();
    setSaveError(message);
    toast.error(message);
    scheduleErrorFocus(
      preferredFocusId ??
        sectionFocusId ??
        (hasFieldError ? undefined : "product-save-error"),
      hasFieldError && !preferredFocusId && !sectionFocusId,
    );
  }

  function onSubmit(
    v: ProductFormValues | null,
    uploader: ProductImageUploaderHandle | null,
  ) {
    setMediaError(null);
    setVariantError(null);
    if (!pendingSaveRef.current) {
      const mediaError = uploader?.validate();
      if (mediaError) {
        setMediaError(mediaError);
        setSavePhase("error");
        applyServerErrors(new Error(mediaError), "product-images-trigger");
        return;
      }
    }
    setSaveError(null);
    clearErrors();
    setSavePhase(pendingSaveRef.current ? "saving" : "preparing");
    startTransition(async () => {
      try {
        let attempt = pendingSaveRef.current;
        if (!attempt) {
          if (!v) return;
          uploader?.preservePrepared(false);
          const images = (await uploader?.prepare()) ?? [];
          setSavePhase("saving");
          attempt = {
            productId: mode === "edit" ? (product?.id ?? null) : null,
            payload: toAggregatePayload(
              v,
              createOperationId(),
              revisionRef.current,
              images,
            ),
          };
          pendingSaveRef.current = attempt;
          try {
            sessionStorage.setItem(recoveryKey, JSON.stringify(attempt));
          } catch {
            // The in-memory envelope still protects retries in this session.
          }
          // Keep staged keys alive until the request has a definitive outcome.
          uploader?.preservePrepared(true);
        }
        const saved = await saveProductAggregate(
          attempt.productId,
          attempt.payload,
        );
        uploader?.commit(saved.images);
        revisionRef.current = saved.updated_at;
        clearPendingSave();
        reset(getDefaultFormValues(saved));
        releaseHistoryGuard();
        setSavePhase("saved");

        if (mode === "create") {
          toast.success("محصول ایجاد شد");
          router.push(`/admin/products/${saved.id}`);
          router.refresh();
          return;
        }
        toast.success("تغییرات ذخیره شد");
        router.refresh();
      } catch (e) {
        if (
          e instanceof ProductClientError &&
          e.status >= 400 &&
          e.status < 500
        ) {
          uploader?.preservePrepared(false);
          clearPendingSave();
          setSavePhase(e.status === 409 ? "conflict" : "error");
        } else if (pendingSaveRef.current) {
          uploader?.preservePrepared(true);
          setHasPendingRetry(true);
          setSavePhase("recoverable");
        } else {
          setSavePhase("error");
        }
        applyServerErrors(e);
      }
    });
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const uploader = uploaderRef.current;
    if (pendingSaveRef.current) {
      event.preventDefault();
      onSubmit(null, uploader);
      return;
    }
    void handleSubmit(
      (values) => onSubmit(values, uploader),
      () => {
        setSavePhase("error");
        setSaveError("لطفاً موارد مشخص‌شده در فرم را بررسی کنید.");
        scheduleErrorFocus(undefined, true);
      },
    )(event);
  }

  const editorLocked = isPending || hasPendingRetry;
  const displayedSavePhase: ProductSavePhase =
    savePhase === "saved" && (isDirty || mediaDirty) ? "idle" : savePhase;

  return (
    <form
      ref={formRef}
      onSubmit={onFormSubmit}
      noValidate
      aria-busy={isPending || undefined}
      className="flex flex-col"
    >
      <FormHeaderBar
        mode={mode}
        title={title}
        control={control}
        isSubmitting={isPending}
        isLocked={editorLocked}
        hasPendingRetry={hasPendingRetry}
        savePhase={displayedSavePhase}
        hasUnsavedChanges={hasUnsavedChanges}
        onCancel={() => requestNavigation("/admin/products")}
      />

      {saveError ? (
        <p
          id="product-save-error"
          ref={saveErrorRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {saveError}
        </p>
      ) : null}

      <fieldset disabled={editorLocked} className="contents">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <GeneralInfoSection
              register={register}
              control={control}
              errors={errors}
              categories={categories}
              brands={brands}
            />
            <SpecificationsSection
              register={register}
              control={control}
              errors={errors}
            />
            <TagsSection
              control={control}
              errors={errors}
              initialTags={product?.tags}
              disabled={editorLocked}
            />
            <VariantsSection
              register={register}
              control={control}
              setValue={setValue}
              errors={errors}
              fields={fields}
              append={append}
              remove={remove}
              optionTypes={optionTypes}
              productVariants={product?.variants}
              error={variantError}
              disabled={editorLocked}
            />

            <ImagesSection
              uploaderRef={uploaderRef}
              productId={product?.id ?? null}
              mode={mode}
              initialImages={product?.images ?? []}
              disabled={editorLocked}
              error={mediaError}
              onDirtyChange={setMediaDirty}
              onGalleryChange={setGallerySnapshot}
            />

            <SeoSection register={register} errors={errors} />
          </div>

          <aside className="flex flex-col gap-6">
            <div className="lg:sticky lg:top-20">
              <PreviewCard
                imageUrl={gallerySnapshot.primaryUrl}
                title={title}
                brandName={brandName}
                isActive={isActive}
                mode={mode}
              />
            </div>
          </aside>
        </div>
      </fieldset>

      <MobileActionBar
        control={control}
        isSubmitting={isPending}
        isLocked={editorLocked}
        hasPendingRetry={hasPendingRetry}
        savePhase={displayedSavePhase}
        onCancel={() => requestNavigation("/admin/products")}
      />

      <UnsavedChangesDialog
        open={pendingNavigation !== null}
        isSaving={isPending}
        hasPendingRetry={hasPendingRetry}
        onStay={() => setPendingNavigation(null)}
        onDiscard={confirmNavigation}
      />
    </form>
  );
}

function historyGuardID(state: unknown) {
  if (!state || typeof state !== "object") return undefined;
  const id = (state as Record<string, unknown>)[HISTORY_GUARD_KEY];
  return typeof id === "string" ? id : undefined;
}

function isProductImagePath(path: string) {
  return path === "images" || path.startsWith("images.");
}

function isProductVariantSectionPath(path: string) {
  return path === "variants" || /^variants\.\d+\.id$/.test(path);
}

function isProductFormPath(path: string) {
  return (
    [
      "title",
      "slug",
      "code",
      "description",
      "category_id",
      "brand_id",
      "country_of_origin",
      "abv",
      "weight",
      "meta_title",
      "meta_description",
      "meta_tags",
      "tag_ids",
      "is_active",
    ].includes(path) ||
    /^variants\.\d+\.(sku|price|compare_at_price|is_active|option_value_ids)$/.test(
      path,
    )
  );
}

const PRODUCT_SERVER_ERROR_MESSAGES: Record<string, string> = {
  "must be greater than price":
    "قیمت پیش از تخفیف باید بیشتر از قیمت فروش باشد",
  "staged upload is missing or invalid":
    "فایل آماده‌شده در دسترس نیست؛ تصویر در تلاش بعدی دوباره بارگذاری می‌شود.",
  "external image URL is invalid": "نشانی تصویر خارجی معتبر نیست.",
  "exactly one product image must be primary":
    "دقیقاً یک تصویر باید به‌عنوان تصویر اصلی انتخاب شود.",
  "image does not belong to this product": "این تصویر متعلق به محصول نیست.",
  "image is already attached": "این تصویر قبلاً به محصول متصل شده است.",
  "one or more removed variants are still in use":
    "یک یا چند تنوع حذف‌شده دارای موجودی یا سابقهٔ عملیاتی هستند.",
  "variant does not belong to this product": "این تنوع متعلق به محصول نیست.",
  "SKU is already used by another variant": "این SKU قبلاً استفاده شده است.",
  "SKU must be unique": "SKU هر تنوع باید یکتا باشد.",
  "option combination must be unique": "ترکیب ویژگی هر تنوع باید یکتا باشد.",
  "option combination is already used by another variant":
    "این ترکیب ویژگی قبلاً برای تنوع دیگری استفاده شده است.",
  "only one value from each option type may be selected":
    "از هر نوع ویژگی فقط یک مقدار انتخاب کنید.",
  "one or more option values do not exist":
    "یک یا چند مقدار ویژگی دیگر در دسترس نیست.",
  "one or more tags do not exist": "یک یا چند برچسب دیگر در دسترس نیست.",
  "code is already used by another product":
    "این کد برای محصول دیگری استفاده شده است.",
  "slug is already used by another product":
    "این نامک برای محصول دیگری استفاده شده است.",
  "category does not exist": "دسته‌بندی انتخاب‌شده در دسترس نیست.",
  "brand does not exist": "برند انتخاب‌شده در دسترس نیست.",
  "product changed after this editor was loaded":
    "محصول پس از باز شدن این فرم تغییر کرده است؛ صفحه را تازه‌سازی کنید.",
};

function localizeProductServerError(message: string) {
  return PRODUCT_SERVER_ERROR_MESSAGES[message] ?? message;
}
