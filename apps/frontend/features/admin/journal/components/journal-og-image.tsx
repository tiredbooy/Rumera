"use client";

import * as React from "react";
import { Loader2, Share2, Trash2, Upload } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadOwnerMedia } from "@/features/admin/shared/upload-owner-media";
import { validateFile } from "@/features/image-uploader/constants";

/**
 * CE-10. The journal post's Open Graph image.
 *
 * Separate from the cover because the two crops differ: the cover is a 4:3 hero
 * and a social card is 1.91:1, so sharing a post used to hand Telegram and X a
 * hero with its subject cropped out. Empty falls back to the cover, which is
 * what `generateMetadata` and `journalArticleLd` do.
 *
 * A local file goes through the owner-scoped upload route, which writes the blob
 * and the `blogs.og_image_url` column in one transaction — so unlike every other
 * field here it is durable the moment it succeeds, and it needs a saved post to
 * attach to.
 */
export function JournalOGImage({
  postId,
  value,
  onChange,
  fallbackURL,
  disabled,
}: {
  postId?: number;
  value: string;
  onChange: (url: string) => void;
  fallbackURL?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = "og_image_file";

  async function handleFile(file: File | undefined) {
    if (!file || !postId) return;
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadOwnerMedia("journal", postId, "og", file);
      onChange(uploaded.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "بارگذاری تصویر ناموفق بود",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <Share2 className="size-3.5" aria-hidden /> تصویر اشتراک‌گذاری (OG)
      </p>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        تصویری که هنگام هم‌رسانی در شبکه‌های اجتماعی دیده می‌شود؛ نسبت ۱۲۰۰×۶۳۰
        پیشنهاد می‌شود. خالی یعنی از تصویر شاخص استفاده شود.
      </p>

      <div className="flex flex-wrap items-start gap-4">
        <div className="border-hairline relative aspect-[1.91/1] w-48 shrink-0 overflow-hidden rounded-xl bg-muted">
          <SmartImage
            key={value || fallbackURL || "empty"}
            src={value || fallbackURL || null}
            alt=""
            sizes="192px"
            label={value ? undefined : "تصویر شاخص"}
          />
        </div>

        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor="og_image_url" className="text-xs">
            نشانی تصویر
          </Label>
          <Input
            id="og_image_url"
            dir="ltr"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://… یا بارگذاری فایل"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy || !postId}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              بارگذاری فایل
            </Button>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled || !postId}
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={disabled || busy}
                onClick={() => onChange("")}
              >
                <Trash2 className="size-4" aria-hidden /> حذف
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {postId
              ? "بارگذاری فایل بلافاصله روی نوشته ذخیره می‌شود."
              : "برای بارگذاری فایل، ابتدا نوشته را ذخیره کنید."}
          </p>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
