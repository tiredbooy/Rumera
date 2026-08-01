"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";
import { releaseUpload, uploadImage, uploadOwnerImage } from "./client";
import { ACCEPT, MAX_MB, validateImageURL } from "./constants";
import type {
  ContentMediaTarget,
  ImageUploaderHandle,
  UploadedImage,
} from "./types";
import { UploadProgressBar } from "./UploadProgressBar";

type ImageInputPersistence =
  | { owner: ContentMediaTarget; legacyFolder?: never }
  | { owner?: never; legacyFolder: string };

export type ImageInputProps = ImageInputPersistence & {
  id?: string;
  value: string;
  maxSizeMB?: number;
  accept?: string[];
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onBlur?: () => void;
  onStagedChange?: (staged: boolean) => void;
  onPreviewChange?: (url: string) => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  previewClassName?: string;
  /** Skip the built-in preview when the parent already renders one. */
  hidePreview?: boolean;
  altValue?: string;
  altInputId?: string;
  altLabel?: string;
  altDescription?: string;
  altPlaceholder?: string;
  altError?: string;
  altInputRef?: React.Ref<HTMLInputElement>;
  onAltChange?: (alt: string) => void;
  onAltBlur?: () => void;
  name?: string;
  urlInputRef?: React.Ref<HTMLInputElement>;
};

type StagedFile = { file: File; previewUrl: string };

/** URL-or-file input for one explicit content-owner role. */
export const ImageInput = React.forwardRef<
  ImageUploaderHandle<UploadedImage | null>,
  ImageInputProps
>(function ImageInput(
  {
    id,
    value,
    onChange,
    onUploadingChange,
    maxSizeMB = MAX_MB,
    accept,
    onBlur,
    owner,
    legacyFolder,
    onStagedChange,
    onPreviewChange,
    placeholder = "https://… یا بارگذاری فایل",
    ariaInvalid,
    ariaDescribedBy,
    disabled,
    previewClassName,
    hidePreview,
    altValue,
    altInputId = `${id ?? "image"}-alt`,
    altLabel = "متن جایگزین تصویر",
    altDescription,
    altPlaceholder = "تصویر را کوتاه و دقیق توصیف کنید",
    altError,
    altInputRef,
    onAltChange,
    onAltBlur,
    name,
    urlInputRef,
  },
  ref,
) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const stagedRef = React.useRef<StagedFile | null>(null);
  const valueRef = React.useRef(value);
  const baselineURLRef = React.useRef(value.trim());
  const flushRef = React.useRef<Promise<UploadedImage | null> | null>(null);
  const selectionErrorRef = React.useRef<string | null>(null);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  const pendingLegacyUploadRef = React.useRef<UploadedImage | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [staged, setStaged] = React.useState<StagedFile | null>(null);
  const acceptedTypes = accept ?? [...ACCEPT];
  const uploadErrorId = `${id ?? "image"}-upload-error`;
  const describedBy =
    [ariaDescribedBy, error ? uploadErrorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  valueRef.current = value;

  function validateSelectedFile(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) {
      return "فرمت پشتیبانی نمی‌شود (JPG/PNG/WebP/AVIF)";
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `حجم باید کمتر از ${maxSizeMB} مگابایت باشد`;
    }
    return null;
  }

  function replaceStaged(next: StagedFile | null) {
    stagedRef.current = next;
    setStaged(next);
    onStagedChange?.(next !== null);
  }

  function clearStaged(restorePreview: boolean) {
    const current = stagedRef.current;
    if (!current) return;
    URL.revokeObjectURL(current.previewUrl);
    replaceStaged(null);
    if (restorePreview) onPreviewChange?.(valueRef.current);
  }

  function releasePendingLegacyUpload() {
    const pending = pendingLegacyUploadRef.current;
    if (!pending) return;
    pendingLegacyUploadRef.current = null;
    void releaseUpload(pending.key).catch(() => {
      // Reconciliation is the durable fallback for failed best-effort release.
    });
  }

  React.useEffect(
    () => () => {
      uploadAbortRef.current?.abort();
      const current = stagedRef.current;
      if (current) URL.revokeObjectURL(current.previewUrl);
    },
    [],
  );

  function validateCurrent(): string | null {
    if (selectionErrorRef.current) return selectionErrorRef.current;
    const current = stagedRef.current;
    if (current) return validateSelectedFile(current.file);
    const normalized = valueRef.current.trim();
    return validateImageURL(normalized, {
      allowEmpty: true,
      allowMediaPath:
        normalized.startsWith("/media/") &&
        normalized === baselineURLRef.current,
    });
  }

  async function runUpload(
    operation: (
      onProgress: (fraction: number) => void,
    ) => Promise<UploadedImage>,
  ) {
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    setError(null);
    try {
      const result = await operation(setProgress);
      baselineURLRef.current = result.url;
      onChange(result.url);
      onPreviewChange?.(result.url);
      return result;
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "بارگذاری ناموفق بود";
      setError(message);
      throw uploadError;
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  async function handleFile(file: File) {
    const fileError = validateSelectedFile(file);
    if (fileError) {
      selectionErrorRef.current = fileError;
      setError(fileError);
      return;
    }

    selectionErrorRef.current = null;
    setError(null);
    if (owner) {
      clearStaged(false);
      const baseline = baselineURLRef.current;
      const baselineError = validateImageURL(baseline, {
        allowEmpty: true,
        allowMediaPath: baseline.startsWith("/media/"),
      });
      const restoredValue = baselineError ? "" : baseline;
      if (valueRef.current.trim() !== restoredValue || baselineError) {
        valueRef.current = restoredValue;
        onChange(restoredValue);
      }
      const next = { file, previewUrl: URL.createObjectURL(file) };
      replaceStaged(next);
      onPreviewChange?.(next.previewUrl);
      return;
    }

    const previousUpload = pendingLegacyUploadRef.current;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const result = await runUpload((onProgress) =>
        uploadImage(
          file,
          { folder: legacyFolder, signal: controller.signal },
          onProgress,
        ),
      );
      pendingLegacyUploadRef.current = result;
      if (previousUpload && previousUpload.key !== result.key) {
        void releaseUpload(previousUpload.key).catch(() => {
          // Reconciliation cleans a release that cannot complete now.
        });
      }
    } catch {
      // runUpload keeps the actionable error in the field.
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
    }
  }

  React.useImperativeHandle(ref, () => ({
    hasStaged: staged !== null,
    isBusy: uploading,
    validate() {
      const validationError = validateCurrent();
      setError(validationError);
      return validationError;
    },
    flush(ownerId?: number) {
      if (flushRef.current) return flushRef.current;
      const current = stagedRef.current;
      if (!current) return Promise.resolve(null);

      const validationError = validateSelectedFile(current.file);
      if (validationError) {
        setError(validationError);
        return Promise.reject(new Error(validationError));
      }
      const targetOwnerId = ownerId ?? owner?.ownerId ?? null;
      if (!owner || !targetOwnerId || targetOwnerId <= 0) {
        const ownerError = new Error("شناسه مالک تصویر در دسترس نیست");
        setError(ownerError.message);
        return Promise.reject(ownerError);
      }

      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const operation = runUpload((onProgress) =>
        uploadOwnerImage(
          current.file,
          { ...owner, ownerId: targetOwnerId },
          altValue === undefined ||
            (owner.ownerType === "recipes" && owner.role === "og")
            ? { signal: controller.signal }
            : { altText: altValue, signal: controller.signal },
          onProgress,
        ),
      )
        .then((result) => {
          if (stagedRef.current === current) clearStaged(false);
          return result;
        })
        .finally(() => {
          if (uploadAbortRef.current === controller)
            uploadAbortRef.current = null;
          flushRef.current = null;
        });
      flushRef.current = operation;
      return operation;
    },
  }));

  const normalizedValue = value.trim();
  const persistedPreviewURL =
    validateImageURL(normalizedValue, {
      allowEmpty: true,
      allowMediaPath:
        normalizedValue.startsWith("/media/") &&
        normalizedValue === baselineURLRef.current,
    }) === null
      ? normalizedValue
      : "";
  const previewURL = staged?.previewUrl ?? persistedPreviewURL;
  const unavailable = disabled || uploading;

  return (
    <div className="flex flex-col gap-2" aria-busy={uploading || undefined}>
      <div className="flex items-center gap-2">
        <Input
          ref={urlInputRef}
          id={id}
          name={name}
          dir="ltr"
          value={value}
          placeholder={placeholder}
          inputMode="url"
          aria-invalid={ariaInvalid || !!error}
          aria-describedby={describedBy}
          disabled={unavailable}
          onChange={(event) => {
            clearStaged(false);
            if (!owner) releasePendingLegacyUpload();
            selectionErrorRef.current = null;
            setError(null);
            onChange(event.target.value);
            const nextValue = event.target.value.trim();
            const nextPreview = validateImageURL(nextValue, {
              allowEmpty: true,
              allowMediaPath:
                nextValue.startsWith("/media/") &&
                nextValue === baselineURLRef.current,
            })
              ? ""
              : nextValue;
            onPreviewChange?.(nextPreview);
          }}
          onBlur={() => {
            const validationError = validateCurrent();
            setError(validationError);
            onBlur?.();
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={unavailable}
          onClick={() => inputRef.current?.click()}
          aria-label="بارگذاری تصویر"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          <span className="hidden sm:inline">بارگذاری</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          className="hidden"
          disabled={unavailable}
          aria-label="انتخاب فایل تصویر"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {onAltChange ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={altInputId}>{altLabel}</Label>
          {altDescription ? (
            <p className="text-xs text-muted-foreground">{altDescription}</p>
          ) : null}
          <Input
            ref={altInputRef}
            id={altInputId}
            value={altValue ?? ""}
            maxLength={255}
            placeholder={altPlaceholder}
            aria-invalid={!!altError}
            aria-describedby={altError ? `${altInputId}-error` : undefined}
            disabled={unavailable}
            onChange={(event) => onAltChange(event.target.value)}
            onBlur={onAltBlur}
          />
          {altError ? (
            <p
              id={`${altInputId}-error`}
              role="alert"
              className="text-xs text-destructive"
            >
              {altError}
            </p>
          ) : null}
        </div>
      ) : null}

      {staged ? (
        <div className="flex min-h-11 items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="min-w-0 truncate">
            فایل آمادهٔ بارگذاری: {staged.file.name}
          </p>
          {hidePreview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unavailable}
              onClick={() => {
                clearStaged(true);
                selectionErrorRef.current = null;
                setError(null);
              }}
            >
              لغو جایگزینی
            </Button>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <UploadProgressBar progress={progress} label="پیشرفت بارگذاری تصویر" />
      ) : null}

      {error ? (
        <p id={uploadErrorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {previewURL && !hidePreview ? (
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted",
            previewClassName,
          )}
        >
          {staged ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL before upload.
            <img
              src={previewURL}
              alt={altValue || "پیش‌نمایش تصویر"}
              className="h-full w-full object-cover"
            />
          ) : (
            <SmartImage
              key={previewURL}
              src={previewURL}
              alt={altValue || "پیش‌نمایش تصویر"}
              sizes="400px"
            />
          )}
          <button
            type="button"
            disabled={unavailable}
            onClick={() => {
              selectionErrorRef.current = null;
              if (stagedRef.current) {
                clearStaged(true);
              } else {
                if (!owner) releasePendingLegacyUpload();
                baselineURLRef.current = "";
                onChange("");
                onPreviewChange?.("");
              }
              setError(null);
            }}
            aria-label={staged ? "لغو جایگزینی تصویر" : "حذف تصویر"}
            className="absolute end-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-xl bg-background/80 text-foreground outline-none ring-1 ring-foreground/10 backdrop-blur-md transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
});
