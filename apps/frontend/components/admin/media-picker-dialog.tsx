"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Upload } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/features/image-uploader/client";
import {
  MAX_IMAGE_ALT_LENGTH,
  validateFile,
  validateImageURL,
} from "@/features/image-uploader/constants";
import { apiErrorMessage } from "@/lib/api/user-facing-error";
import { cn } from "@/lib/utils";

/**
 * CE-10. One reusable media library, shared by every editorial surface that
 * needs to name an image: pick something already on the site, upload a new
 * file, or paste an external HTTPS address.
 *
 * The library reads `GET /admin/uploads`, which lists stored originals newest
 * first. Uploads made here are standalone (no owner row) — `media-reconcile`
 * keeps them because the body that references them is part of the reference
 * scan, see `mediaReferencesCTE`.
 */

export type MediaPick = { url: string; alt: string };

type LibraryItem = {
  url: string;
  key: string;
  size: number;
  modified_at: string;
};

async function fetchLibrary(search: string): Promise<LibraryItem[]> {
  const query = new URLSearchParams({ limit: "60" });
  if (search) query.set("q", search);
  const response = await fetch(`/api/admin/admin/uploads?${query}`, {
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      apiErrorMessage(body, "بارگذاری کتابخانهٔ رسانه ناموفق بود"),
    );
  }
  const data = (body as { data?: LibraryItem[] } | null)?.data;
  return Array.isArray(data) ? data : [];
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  initial,
  title = "درج تصویر",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pick: MediaPick) => void;
  initial?: MediaPick;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-2xl">
        {/* Radix unmounts this while closed, so the body re-seeds from the
            current selection on every open without an effect. */}
        <MediaPickerBody
          title={title}
          initial={initial}
          onPick={onPick}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function MediaPickerBody({
  title,
  initial,
  onPick,
  onClose,
}: {
  title: string;
  initial?: MediaPick;
  onPick: (pick: MediaPick) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = React.useState(initial?.url ?? "");
  const [alt, setAlt] = React.useState(initial?.alt ?? "");
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const deferredSearch = React.useDeferredValue(search.trim());

  const library = useQuery({
    queryKey: ["admin", "media-library", deferredSearch],
    queryFn: () => fetchLibrary(deferredSearch),
    staleTime: 60 * 1000,
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadImage(file, { folder: "uploads" });
      setUrl(uploaded.url);
      await library.refetch();
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError, "بارگذاری تصویر ناموفق بود"));
    } finally {
      setUploading(false);
    }
  }

  function confirm() {
    const urlError = validateImageURL(url, { allowMediaPath: true });
    if (urlError) {
      setError(urlError);
      return;
    }
    if (!alt.trim()) {
      setError("برای تصویر متن جایگزین بنویسید");
      return;
    }
    onPick({ url: url.trim(), alt: alt.trim() });
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          تصویری از کتابخانه انتخاب کنید، فایل تازه‌ای بارگذاری کنید یا نشانی
          HTTPS بگذارید.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="media-picker-url">نشانی تصویر</Label>
          <Input
            id="media-picker-url"
            dir="ltr"
            className="mt-1.5"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => document.getElementById("media-picker-file")?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          بارگذاری فایل
        </Button>
        <input
          id="media-picker-file"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <div>
        <Label htmlFor="media-picker-alt">متن جایگزین</Label>
        <Input
          id="media-picker-alt"
          className="mt-1.5"
          maxLength={MAX_IMAGE_ALT_LENGTH}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="تصویر را برای خواننده‌ای که آن را نمی‌بیند توصیف کنید"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">کتابخانهٔ رسانه</p>
          <Input
            type="search"
            className="h-9 w-44"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در نام فایل…"
            aria-label="جستجو در کتابخانهٔ رسانه"
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto rounded-xl border border-border/60 p-2"
          aria-live="polite"
        >
          {library.isLoading ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden /> در حال
              بارگذاری…
            </p>
          ) : library.isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">
                کتابخانهٔ رسانه در دسترس نیست.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => library.refetch()}
              >
                تلاش دوباره
              </Button>
            </div>
          ) : library.data?.length ? (
            <ul className="grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-5">
              {library.data.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-label={item.key}
                    aria-pressed={item.url === url}
                    onClick={() => setUrl(item.url)}
                    className={cn(
                      "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg ring-1 ring-border/60 transition-shadow",
                      item.url === url && "ring-2 ring-primary",
                    )}
                  >
                    <SmartImage src={item.url} alt="" sizes="120px" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <ImagePlus className="size-5" aria-hidden /> تصویری در کتابخانه
              نیست.
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          انصراف
        </Button>
        <Button type="button" onClick={confirm} disabled={uploading}>
          درج تصویر
        </Button>
      </DialogFooter>
    </>
  );
}
