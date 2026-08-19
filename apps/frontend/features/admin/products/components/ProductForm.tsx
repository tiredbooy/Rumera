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

import {
  getAdminProduct,
  ProductClientError,
  saveProductAggregate,
} from "@/features/admin/products/api/client";

import { rebaseProductForm } from "../conflict-rebase";
import { collectProductFormErrors } from "../form-errors";

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
import {
  PRODUCT_FORM_SECTIONS,
  productFormSectionForTarget,
  productFormSectionId,
  useProductFormSection,
  type ProductFormSectionKey,
} from "./product-form/sections";
import {
  unknownBrandLabel,
  type BrandOption,
} from "./product-form/BrandSelect";
import {
  PRODUCT_ERROR_SUMMARY_ID,
  ProductErrorSummary,
} from "./product-form/ErrorSummary";
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
import type { InventoryItem } from "@/features/inventory/types";

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
  selectedBrand = null,
  tags = [],
  optionTypes = [],
  optionCatalogError = null,
  inventory = [],
  canWrite = true,
  canAdjustStock = false,
}: {
  mode: "create" | "edit";
  product?: AdminProductDetail;
  categories: Category[];
  /** The product's own brand, looked up by id so it survives page-one (PE-4). */
  selectedBrand?: BrandOption | null;
  tags?: Tag[];
  optionTypes?: ProductOptionGroup[];
  optionCatalogError?: string | null;
  /** Ledger rows for the persisted variants, so stock is adjustable here (PE-11). */
  inventory?: InventoryItem[];
  canWrite?: boolean;
  canAdjustStock?: boolean;
}) {
  const router = useRouter();
  const { section, search, selectSection } = useProductFormSection();
  const [isPending, startTransition] = useTransition();
  const [savePhase, setSavePhase] = React.useState<ProductSavePhase>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = React.useState<string | null>(
    null,
  );
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
  // The revision the operator is editing against — the ancestor of a rebase.
  const baselineRef = React.useRef(getDefaultFormValues(product));
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
    getValues,
    formState: { errors, isDirty, submitCount },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultFormValues(product),
    shouldFocusError: false,
    // Report a field once the operator has left it, not on every keystroke —
    // waiting for submit meant a 64-variant product failed all at once (PE-6).
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const title = useWatch({ control, name: "title" });
  const brandId = useWatch({ control, name: "brand_id" });
  const isActive = useWatch({ control, name: "is_active" });
  const [brandOption, setBrandOption] = React.useState<BrandOption | null>(
    selectedBrand,
  );
  // The preview used to read the brand out of the first 100, so a product on
  // brand #101 previewed as brand-less — the same lie the picker told (PE-4).
  const brandName = brandId
    ? brandOption && String(brandOption.id) === brandId
      ? brandOption.title
      : unknownBrandLabel(Number(brandId))
    : undefined;
  const hasUnsavedChanges = isDirty || mediaDirty || hasPendingRetry;
  // Rebuilt on every render, never memoised: react-hook-form mutates `errors`
  // in place, so a dependency on it would freeze the summary at whatever was
  // wrong the first time and let it go stale as fields are fixed.
  const errorEntries = collectProductFormErrors(errors);
  if (variantError) {
    errorEntries.push({
      key: "section:variants",
      label: "تنوع‌ها",
      message: variantError,
      targetId: "product-variants-trigger",
    });
  }
  if (mediaError) {
    errorEntries.push({
      key: "section:images",
      label: "رسانه",
      message: mediaError,
      targetId: "product-images-trigger",
    });
  }
  const shouldBlockNavigation = hasUnsavedChanges || isPending;
  // A section the operator cannot see still has to say it is broken; the nav
  // is the only thing on screen that can say so once the others are hidden.
  const sectionHasError: Record<ProductFormSectionKey, boolean> = {
    general: Boolean(
      errors.title ||
      errors.slug ||
      errors.code ||
      errors.category_id ||
      errors.brand_id ||
      errors.description,
    ),
    specs: Boolean(errors.weight || errors.abv || errors.country_of_origin),
    tags: Boolean(errors.tag_ids),
    variants: Boolean(errors.variants || variantError || optionCatalogError),
    images: Boolean(mediaError),
    seo: Boolean(
      errors.meta_title || errors.meta_description || errors.meta_tags,
    ),
  };

  /**
   * Open whichever section holds a jump target before anything tries to focus
   * it (PE-5 × PE-6). A hidden section is `display:none`, so `focus()` on a
   * field inside one is a no-op and the error-summary link would do nothing.
   */
  const revealSection = React.useCallback(
    (targetId: string | undefined) => {
      const key = targetId ? productFormSectionForTarget(targetId) : undefined;
      // Replaces rather than pushes: revealing an error is part of the click
      // the operator already made, not a step to go «back» from.
      if (key) selectSection(key, { push: false });
    },
    [selectSection],
  );

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
      // Section links (PE-5) and error-summary jumps stay on this page: they
      // change the query or the hash, never the route, and must not raise the
      // unsaved-changes dialog (PE-3).
      if (destination.pathname === window.location.pathname) return;
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

    const formPathname = window.location.pathname;

    const guardHistoryNavigation = (event: PopStateEvent) => {
      if (allowHistoryNavigationRef.current) {
        allowHistoryNavigationRef.current = false;
        return;
      }
      // Stepping back through sections lands on the same page; only the guard
      // marker distinguishes entries pushed before the form went dirty, and
      // those are section entries too.
      if (window.location.pathname === formPathname) return;
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
    let firstErrorTargetId: string | undefined;
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
        firstErrorTargetId ??= path;
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
    const focusId =
      preferredFocusId ??
      sectionFocusId ??
      (hasFieldError ? PRODUCT_ERROR_SUMMARY_ID : "product-save-error");
    revealSection(preferredFocusId ?? sectionFocusId ?? firstErrorTargetId);
    scheduleErrorFocus(
      focusId,
      hasFieldError && !preferredFocusId && !sectionFocusId,
    );
  }

  /**
   * PE-2: a colleague saved first. Re-read their revision, re-apply this
   * operator's edits on top of it and report the overlap — resubmitting the
   * whole payload against the fresh revision would erase their work silently.
   * Returns false when the conflict cannot be rebased (the caller then falls
   * back to reporting it).
   */
  async function rebaseOnConflict(uploader: ProductImageUploaderHandle | null) {
    const productId = mode === "edit" ? product?.id : undefined;
    if (!productId) return false;
    let fresh: AdminProductDetail;
    try {
      fresh = await getAdminProduct(productId);
    } catch {
      return false;
    }

    // Prepared uploads are re-sent by storage key, so the next attempt reuses
    // them instead of uploading the same file twice.
    uploader?.preservePrepared(true);
    // The frozen envelope carries the stale revision; it can never succeed.
    clearPendingSave();

    const theirs = getDefaultFormValues(fresh);
    const rebase = rebaseProductForm(baselineRef.current, getValues(), theirs);
    const gallery = uploader?.rebase(fresh.images) ?? {
      dropped: 0,
      adopted: 0,
    };

    revisionRef.current = fresh.updated_at;
    baselineRef.current = theirs;
    // Two resets: the colleague's revision becomes the clean baseline, then
    // our edits go back on top so they still read as unsaved changes.
    reset(theirs);
    reset(rebase.values, { keepDefaultValues: true });

    setSavePhase("conflict");
    setSaveError(null);
    setConflictNotice(conflictNoticeText(rebase, gallery));
    scheduleErrorFocus("product-conflict-notice");
    return true;
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
    setConflictNotice(null);
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
        baselineRef.current = getDefaultFormValues(saved);
        reset(baselineRef.current);
        setConflictNotice(null);
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
        if (isStaleRevisionConflict(e) && (await rebaseOnConflict(uploader))) {
          return;
        }
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
      (invalid) => {
        setSavePhase("error");
        // The summary below lists every failure by name; a second generic
        // sentence above it would only add noise.
        setSaveError(null);
        revealSection(collectProductFormErrors(invalid)[0]?.targetId);
        scheduleErrorFocus(PRODUCT_ERROR_SUMMARY_ID, true);
      },
    )(event);
  }

  // A pending retry replays a frozen payload, so edits made now could never
  // reach the server — lock the fields instead of losing them silently.
  const fieldsLocked = !canWrite || hasPendingRetry;
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

      {submitCount > 0 ? (
        <ProductErrorSummary
          entries={errorEntries}
          onJump={(targetId) => {
            revealSection(targetId);
            scheduleErrorFocus(targetId);
          }}
        />
      ) : null}

      {conflictNotice ? (
        <p
          id="product-conflict-notice"
          tabIndex={-1}
          role="status"
          className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-200"
        >
          {conflictNotice}
        </p>
      ) : null}

      <ProductFormSectionNav
        active={section}
        search={search}
        onSelect={selectSection}
        sections={PRODUCT_FORM_SECTIONS.map((entry) => ({
          ...entry,
          hasError: sectionHasError[entry.key],
        }))}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <fieldset disabled={fieldsLocked} className="contents">
            {/* Hidden, never unmounted: unmounting would drop the gallery's
                staged uploads and every uncommitted react-hook-form value. */}
            <div
              id={productFormSectionId("general")}
              hidden={section !== "general"}
            >
              <GeneralInfoSection
                register={register}
                control={control}
                errors={errors}
                categories={categories}
                selectedBrand={brandOption}
                onBrandChange={setBrandOption}
              />
            </div>
            <div
              id={productFormSectionId("specs")}
              hidden={section !== "specs"}
            >
              <SpecificationsSection
                register={register}
                control={control}
                errors={errors}
              />
            </div>
            <div id={productFormSectionId("tags")} hidden={section !== "tags"}>
              <TagsSection
                control={control}
                errors={errors}
                tags={tags}
                initialTags={product?.tags}
                disabled={fieldsLocked}
              />
            </div>
          </fieldset>

          <div
            id={productFormSectionId("variants")}
            hidden={section !== "variants"}
          >
            <VariantsSection
              register={register}
              control={control}
              setValue={setValue}
              getValues={getValues}
              errors={errors}
              fields={fields}
              append={append}
              remove={remove}
              optionTypes={optionTypes}
              optionCatalogError={optionCatalogError}
              productVariants={
                mode === "edit" ? product?.variants : undefined
              }
              inventory={inventory}
              error={variantError}
              disabled={fieldsLocked}
              canAdjustStock={canAdjustStock}
            />
          </div>

          <fieldset disabled={fieldsLocked} className="contents">
            <div
              id={productFormSectionId("images")}
              hidden={section !== "images"}
            >
              <ImagesSection
                uploaderRef={uploaderRef}
                productId={mode === "edit" ? (product?.id ?? null) : null}
                mode={mode}
                initialImages={mode === "edit" ? (product?.images ?? []) : []}
                disabled={fieldsLocked}
                error={mediaError}
                onDirtyChange={setMediaDirty}
                onGalleryChange={setGallerySnapshot}
              />
            </div>

            <div id={productFormSectionId("seo")} hidden={section !== "seo"}>
              <SeoSection register={register} errors={errors} />
            </div>
          </fieldset>
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
          </div>
        </aside>
      </div>

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

/** A 409 the backend raised on the optimistic-concurrency check. */
function isStaleRevisionConflict(error: unknown) {
  return (
    error instanceof ProductClientError &&
    error.status === 409 &&
    Boolean(error.fields?.expected_updated_at)
  );
}

function conflictNoticeText(
  rebase: { overwritten: string[]; droppedVariants: number },
  gallery: { dropped: number; adopted: number },
) {
  const parts = [
    "همکار دیگری این محصول را زودتر ذخیره کرد. تغییرات شما روی نسخهٔ تازه اعمال شد؛ برای ثبت، دوباره ذخیره کنید.",
  ];
  if (rebase.overwritten.length > 0) {
    parts.push(
      `«${rebase.overwritten.join("، ")}» را همکارتان هم تغییر داده بود و مقدار شما جایگزین می‌شود.`,
    );
  }
  if (rebase.droppedVariants > 0) {
    parts.push(
      `${rebase.droppedVariants.toLocaleString("fa-IR")} تنوع که همکارتان حذف کرده بود از فرم برداشته شد.`,
    );
  }
  if (gallery.dropped > 0) {
    parts.push(
      `${gallery.dropped.toLocaleString("fa-IR")} تصویر حذف‌شده از گالری برداشته شد.`,
    );
  }
  if (gallery.adopted > 0) {
    parts.push(
      `${gallery.adopted.toLocaleString("fa-IR")} تصویر تازهٔ همکارتان به گالری افزوده شد.`,
    );
  }
  return parts.join(" ");
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
