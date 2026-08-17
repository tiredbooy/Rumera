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

import { apiErrorMessage, localizeApiText } from "@/lib/api/user-facing-error";

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
import { ProductFormSectionNav } from "./product-form/SectionNav";
import { GeneralInfoSection } from "./product-form/GeneralInfoSection";
import { SpecificationsSection } from "./product-form/SpecificationsSection";
import { VariantsSection } from "./product-form/VariantsSection";
import { ImagesSection } from "./product-form/ImagesSection";
import { SeoSection } from "./product-form/SeoSection";
import { TagsSection } from "./product-form/TagsSection";
import { UnsavedChangesDialog } from "./product-form/UnsavedChangesDialog";
import type { ProductSavePhase } from "./product-form/sidebar/save-status";
import type { Category } from "@/features/catalog/categories/types";
import type { Tag } from "@/features/catalog/tags/types";
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
  tags = [],
  optionTypes = [],
  optionCatalogError = null,
  canWrite = true,
}: {
  mode: "create" | "edit";
  product?: AdminProductDetail;
  categories: Category[];
  brands: Brand[];
  tags?: Tag[];
  optionTypes?: ProductOptionGroup[];
  optionCatalogError?: string | null;
  canWrite?: boolean;
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
    if (!canWrite) return;
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
  }, [canWrite, mode, product?.id, recoveryKey]);

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
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }
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
    let message = apiErrorMessage(e, "خطای غیرمنتظره رخ داد");
    let hasFieldError = false;
    let sectionFocusId: string | undefined;
    let shouldDiscardPrepared = false;
    if (e instanceof ProductClientError && e.fields) {
      const details = Object.entries(e.fields);
      let firstFieldMessage: string | undefined;
      for (const [path, messages] of details) {
        const rawMessage = messages[0];
        if (!rawMessage) continue;
        const fieldMessage = localizeApiText(rawMessage) || rawMessage;
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
    if (!canWrite) return;
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
          router.replace(`/admin/products/${saved.id}`);
        } else {
          toast.success("تغییرات ذخیره شد");
        }
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
    if (!canWrite) {
      event.preventDefault();
      return;
    }
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

  const fieldsLocked = !canWrite;
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
        isLocked={fieldsLocked}
        hasPendingRetry={hasPendingRetry}
        savePhase={displayedSavePhase}
        hasUnsavedChanges={hasUnsavedChanges}
        canWrite={canWrite}
        duplicateHref={
          mode === "edit" && canWrite && product?.id
            ? `/admin/products/new?from=${product.id}`
            : undefined
        }
        onCancel={() => requestNavigation("/admin/products")}
      />

      {canWrite ? null : (
        <p
          role="status"
          className="mb-6 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/60"
        >
          فقط مشاهده — ذخیره، بارگذاری تصویر و تغییر تنوع‌ها به مجوز نوشتن محصول
          نیاز دارد.
        </p>
      )}

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

      <fieldset disabled={fieldsLocked} className="contents">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <div id="product-section-general" className="scroll-mt-28">
              <GeneralInfoSection
                register={register}
                control={control}
                errors={errors}
                categories={categories}
                brands={brands}
              />
            </div>
            <div id="product-section-specs" className="scroll-mt-28">
              <SpecificationsSection
                register={register}
                control={control}
                errors={errors}
              />
            </div>
            <div id="product-section-tags" className="scroll-mt-28">
              <TagsSection
                control={control}
                errors={errors}
                tags={tags}
                initialTags={product?.tags}
                disabled={fieldsLocked}
              />
            </div>
            <div id="product-section-variants" className="scroll-mt-28">
              <VariantsSection
                register={register}
                control={control}
                setValue={setValue}
                errors={errors}
                fields={fields}
                append={append}
                remove={remove}
                optionTypes={optionTypes}
                optionCatalogError={optionCatalogError}
                productVariants={mode === "edit" ? product?.variants : undefined}
                error={variantError}
                disabled={fieldsLocked}
              />
            </div>

            <div id="product-section-images" className="scroll-mt-28">
              <ImagesSection
                uploaderRef={uploaderRef}
                productId={mode === "edit" ? product?.id ?? null : null}
                mode={mode}
                initialImages={mode === "edit" ? product?.images ?? [] : []}
                disabled={fieldsLocked}
                error={mediaError}
                onDirtyChange={setMediaDirty}
                onGalleryChange={setGallerySnapshot}
              />
            </div>

            <div id="product-section-seo" className="scroll-mt-28">
              <SeoSection register={register} errors={errors} />
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:sticky lg:top-20">
              <PreviewCard
                imageUrl={gallerySnapshot.primaryUrl}
                title={title}
                brandName={brandName}
                isActive={isActive}
                mode={mode}
              />
              <ProductFormSectionNav
                className="hidden lg:block"
                sections={[
                  {
                    id: "product-section-general",
                    label: "اطلاعات کلی",
                    hint: "نام، دسته، برند",
                    hasError: Boolean(
                      errors.title ||
                        errors.slug ||
                        errors.category_id ||
                        errors.brand_id,
                    ),
                  },
                  {
                    id: "product-section-specs",
                    label: "مشخصات",
                    hint: "وزن، مبدأ، ABV",
                    hasError: Boolean(errors.weight || errors.abv),
                  },
                  {
                    id: "product-section-tags",
                    label: "برچسب‌ها",
                    hasError: Boolean(errors.tag_ids),
                  },
                  {
                    id: "product-section-variants",
                    label: "تنوع و قیمت",
                    hint: "SKU و گزینه‌ها",
                    hasError: Boolean(
                      errors.variants || variantError || optionCatalogError,
                    ),
                  },
                  {
                    id: "product-section-images",
                    label: "رسانه",
                    hasError: Boolean(mediaError),
                  },
                  {
                    id: "product-section-seo",
                    label: "سئو",
                    hint: "اختیاری",
                    hasError: Boolean(
                      errors.meta_title || errors.meta_description,
                    ),
                  },
                ]}
              />
            </div>
          </aside>
        </div>
      </fieldset>

      <MobileActionBar
        control={control}
        isSubmitting={isPending}
        isLocked={fieldsLocked}
        hasPendingRetry={hasPendingRetry}
        savePhase={displayedSavePhase}
        canWrite={canWrite}
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


