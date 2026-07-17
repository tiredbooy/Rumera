"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { uploadImage } from "@/features/admin/uploads/client";

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

interface FlexibleImageInputProps {
  id?: string;
  value: string;
  maxSizeMB?: number;
  accept?: string[];
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onBlur?: () => void;
  /** Storage bucket on the backend (e.g. "hero", "recipes", "journals"). */
  folder?: string;
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  previewClassName?: string;
  /** Skip the built-in preview when the parent already renders one. */
  hidePreview?: boolean;
}

export function FlexibleImageInput({
  id,
  value,
  onChange,
  onUploadingChange,
  maxSizeMB,
  accept,
  onBlur,
  folder,
  placeholder = "https://… یا بارگذاری فایل",
  ariaInvalid,
  ariaDescribedBy,
  disabled,
  previewClassName,
  hidePreview,
}: FlexibleImageInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const acceptedTypes = accept ?? ACCEPT;
  const uploadErrorId = `${id ?? "image"}-upload-error`;
  const describedBy = [ariaDescribedBy, error ? uploadErrorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

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
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    try {
      const res = await uploadImage(file, { folder }, (f) => setProgress(f));
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

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
          onChange={(e) => onChange(e.target.value)}
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

      {uploading ? (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
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

      {value && !hidePreview ? (
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted",
            previewClassName,
          )}
        >
          <SmartImage src={value} alt="پیش‌نمایش تصویر" sizes="400px" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="حذف تصویر"
            className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md transition-colors hover:bg-background"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
