"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { uploadImage, uploadOwnerImage } from "@/features/admin/uploads/client";
import type {
  FlexibleImageInputHandle,
  OwnerMediaTarget,
  UploadedImage,
} from "@/features/admin/uploads/types";

const MAX_MB = 15;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * A flexible image field: paste a URL **or** upload a file and get a URL back.
 *
 * Controlled (`value`/`onChange` carry the image URL string), so it drops into
 * any react-hook-form via `<Controller>`. Uploads go to the shared
 * `POST /api/admin/admin/uploads` endpoint and the resulting public URL is written back
 * through `onChange`. Reused by the hero, recipe (and future journal) forms.
 */

export interface FlexibleImageInputProps {
  id?: string;
  value: string;
  maxSizeMB?: number;
  accept?: string[];
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onBlur?: () => void;
  /** Storage bucket on the backend (e.g. "hero", "recipes", "journals"). */
  folder?: string;
  /** Closed owner/role target. Files stage until the parent flushes after save. */
  owner?: OwnerMediaTarget;
  onStagedChange?: (staged: boolean) => void;
  onPreviewChange?: (url: string) => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  previewClassName?: string;
  /** Skip the built-in preview when the parent already renders one. */
  hidePreview?: boolean;
}

export const FlexibleImageInput = React.forwardRef<
  FlexibleImageInputHandle,
  FlexibleImageInputProps
>(function FlexibleImageInput(
  {
    id,
    value,
    onChange,
    onUploadingChange,
    maxSizeMB,
    accept,
    onBlur,
    folder,
    owner,
    onStagedChange,
    onPreviewChange,
    placeholder = "https://… یا بارگذاری فایل",
    ariaInvalid,
    ariaDescribedBy,
    disabled,
    previewClassName,
    hidePreview,
  }: FlexibleImageInputProps,
  ref,
) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [staged, setStaged] = React.useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const acceptedTypes = accept ?? ACCEPT;
  const uploadErrorId = `${id ?? "image"}-upload-error`;
  const describedBy =
    [ariaDescribedBy, error ? uploadErrorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  function clearStaged() {
    if (!staged) return;
    URL.revokeObjectURL(staged.previewUrl);
    setStaged(null);
    onStagedChange?.(false);
  }

  React.useEffect(() => {
    return () => {
      if (staged) URL.revokeObjectURL(staged.previewUrl);
    };
  }, [staged]);

  async function runUpload(
    operation: (
      onProgress: (fraction: number) => void,
    ) => Promise<UploadedImage>,
  ) {
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    try {
      const result = await operation(setProgress);
      onChange(result.url);
      onPreviewChange?.(result.url);
      return result;
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "بارگذاری ناموفق بود",
      );
      throw uploadError;
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    if (!acceptedTypes.includes(file.type)) {
      setError(`فرمت پشتیبانی نمی‌شود (${acceptedTypes.join(", ")})`);
      return;
    }
    if (file.size > (maxSizeMB || MAX_MB) * 1024 * 1024) {
      setError(`حجم باید کمتر از ${maxSizeMB || MAX_MB} مگابایت باشد`);
      return;
    }
    if (owner) {
      clearStaged();
      const previewUrl = URL.createObjectURL(file);
      setStaged({ file, previewUrl });
      onStagedChange?.(true);
      onPreviewChange?.(previewUrl);
      return;
    }
    try {
      await runUpload((onProgress) =>
        uploadImage(file, { folder }, onProgress),
      );
    } catch {
      // runUpload keeps the actionable error in the field.
    }
  }

  React.useImperativeHandle(ref, () => ({
    hasStaged: staged !== null,
    async flush(ownerId?: number) {
      if (!staged) return null;
      const targetOwnerId = ownerId ?? owner?.ownerId ?? null;
      if (!owner || !targetOwnerId || targetOwnerId <= 0) {
        const ownerError = new Error("شناسه مالک تصویر در دسترس نیست");
        setError(ownerError.message);
        throw ownerError;
      }
      const result = await runUpload((onProgress) =>
        uploadOwnerImage(
          staged.file,
          { ...owner, ownerId: targetOwnerId },
          onProgress,
        ),
      );
      clearStaged();
      return result;
    },
  }));

  const previewURL = staged?.previewUrl ?? value;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          dir="ltr"
          value={value}
          placeholder={placeholder}
          inputMode="url"
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          disabled={disabled || uploading}
          onChange={(e) => {
            clearStaged();
            onChange(e.target.value);
            onPreviewChange?.(e.target.value);
          }}
          onBlur={onBlur}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
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
          disabled={disabled || uploading}
          aria-label="انتخاب فایل تصویر"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {staged ? (
        <p className="truncate text-xs text-muted-foreground">
          فایل آمادهٔ بارگذاری: {staged.file.name}
        </p>
      ) : null}

      {uploading ? (
        <div
          role="progressbar"
          aria-label="پیشرفت بارگذاری تصویر"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((progress || 0) * 100)}
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.round((progress || 0) * 100)}%` }}
          />
        </div>
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
              alt="پیش‌نمایش تصویر"
              className="h-full w-full object-cover"
            />
          ) : (
            <SmartImage src={previewURL} alt="پیش‌نمایش تصویر" sizes="400px" />
          )}
          <button
            type="button"
            onClick={() => {
              clearStaged();
              onChange("");
              onPreviewChange?.("");
            }}
            aria-label="حذف تصویر"
            className="absolute end-2 top-2 flex size-11 cursor-pointer items-center justify-center rounded-xl bg-background/80 text-foreground outline-none ring-1 ring-foreground/10 backdrop-blur-md transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/60"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
});
