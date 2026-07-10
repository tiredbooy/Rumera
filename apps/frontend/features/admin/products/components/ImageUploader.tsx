"use client";

import * as React from "react";
import { useTransition } from "react";
import {
  AlertCircle,
  GripVertical,
  ImagePlus,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadProductImage } from "../api/client";
import { deleteProductImage, reorderProductImages, setPrimaryImage, updateImageAlt } from "../actions/images";
import type { ProductImage } from "@/lib/catalog/types";
import { OptimizedImage } from "@/components/admin/optimized-image";

const MAX_MB = 15;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type StagedSlot = {
  kind: "staged";
  localId: string;
  file: File;
  previewUrl: string;
  alt: string;
  isPrimary: boolean;
  status: "idle" | "uploading" | "error";
  progress: number;
  error?: string;
};

type UploadedSlot = {
  kind: "uploaded";
  localId: string;
  image: ProductImage;
  alt: string;
};

type Slot = StagedSlot | UploadedSlot;

export type ImageUploaderHandle = {
  hasStaged: boolean;
  /** Upload every staged file (in display order) against `productId`. */
  flush: (productId: number) => Promise<void>;
};

type ImageUploaderProps = {
  productId?: number | null;
  initialImages?: ProductImage[];
};

function validate(file: File): string | null {
  if (!ACCEPT.includes(file.type))
    return "فرمت پشتیبانی نمی‌شود (JPG/PNG/WebP/AVIF)";
  if (file.size > MAX_MB * 1024 * 1024)
    return `حجم باید کمتر از ${MAX_MB} مگابایت باشد`;
  return null;
}

export const ImageUploader = React.forwardRef<
  ImageUploaderHandle,
  ImageUploaderProps
>(function ImageUploader({ productId, initialImages = [] }, ref) {
  const live = typeof productId === "number" && productId > 0;
  const idRef = React.useRef(0);
  const nextId = () => `slot-${idRef.current++}`;

  const [isPending, startTransition] = useTransition();

  const [slots, setSlots] = React.useState<Slot[]>(() =>
    initialImages
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        kind: "uploaded" as const,
        localId: `init-${image.id}`,
        image,
        alt: image.alt_text ?? "",
      })),
  );
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount to avoid leaks.
  React.useEffect(() => {
    return () => {
      setSlots((cur) => {
        cur.forEach(
          (s) => s.kind === "staged" && URL.revokeObjectURL(s.previewUrl),
        );
        return cur;
      });
    };
  }, []);

  const patch = React.useCallback(
    (localId: string, next: Partial<StagedSlot>) => {
      setSlots((cur) =>
        cur.map((s) =>
          s.localId === localId && s.kind === "staged" ? { ...s, ...next } : s,
        ),
      );
    },
    [],
  );

  async function uploadStaged(
    slot: StagedSlot,
    pid: number,
  ): Promise<ProductImage | null> {
    patch(slot.localId, { status: "uploading", progress: 0, error: undefined });
    try {
      const image = await uploadProductImage(
        pid,
        slot.file,
        { altText: slot.alt || undefined, isPrimary: slot.isPrimary },
        (f) => patch(slot.localId, { progress: f }),
      );
      URL.revokeObjectURL(slot.previewUrl);
      setSlots((cur) =>
        cur.map((s) =>
          s.localId === slot.localId
            ? {
                kind: "uploaded",
                localId: s.localId,
                image,
                alt: image.alt_text ?? "",
              }
            : s,
        ),
      );
      return image;
    } catch (e) {
      patch(slot.localId, {
        status: "error",
        error: e instanceof Error ? e.message : "بارگذاری ناموفق بود",
      });
      return null;
    }
  }

  function addFiles(files: FileList | File[]) {
    const incoming: StagedSlot[] = Array.from(files).map((file) => {
      const error = validate(file);
      return {
        kind: "staged",
        localId: nextId(),
        file,
        previewUrl: URL.createObjectURL(file),
        alt: "",
        isPrimary: false,
        status: error ? "error" : "idle",
        progress: 0,
        error: error ?? undefined,
      };
    });
    setSlots((cur) => {
      const hasPrimary = cur.some((s) =>
        s.kind === "uploaded" ? s.image.is_primary : s.isPrimary,
      );
      if (!hasPrimary && incoming[0] && !incoming[0].error)
        incoming[0].isPrimary = true;
      return [...cur, ...incoming];
    });
    if (live) {
      incoming.forEach((s) => {
        if (!s.error) uploadStaged(s, productId);
      });
    }
  }

  function removeSlot(slot: Slot) {
    if (slot.kind === "staged") {
      URL.revokeObjectURL(slot.previewUrl);
      setSlots((cur) => cur.filter((s) => s.localId !== slot.localId));
      return;
    }
    setSlots((cur) => cur.filter((s) => s.localId !== slot.localId));
    if (live) {
      startTransition(async () => {
        try {
          await deleteProductImage(productId, slot.image.id);
        } catch {
          // Re-add on failure so the UI stays truthful.
          setSlots((cur) => [...cur, slot]);
        }
      });
    }
  }

  function makePrimary(slot: Slot) {
    setSlots((cur) =>
      cur.map((s) => {
        const isThis = s.localId === slot.localId;
        if (s.kind === "uploaded")
          return { ...s, image: { ...s.image, is_primary: isThis } };
        return { ...s, isPrimary: isThis };
      }),
    );
    if (live && slot.kind === "uploaded") {
      startTransition(async () => {
        await setPrimaryImage(productId, slot.image.id).catch(() => {});
      });
    }
  }

  function setAlt(slot: Slot, alt: string) {
    setSlots((cur) =>
      cur.map((s) => (s.localId === slot.localId ? { ...s, alt } : s)),
    );
  }

  function commitAlt(slot: Slot) {
    if (live && slot.kind === "uploaded") {
      startTransition(async () => {
        await updateImageAlt(productId, slot.image.id, slot.alt).catch(
          () => {},
        );
      });
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= slots.length || from === to) return;
    setSlots((cur) => {
      const next = cur.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      if (live) {
        const ids = next
          .filter((s): s is UploadedSlot => s.kind === "uploaded")
          .map((s) => s.image.id);
        if (ids.length > 1) {
          startTransition(async () => {
            await reorderProductImages(productId, ids).catch(() => {});
          });
        }
      }
      return next;
    });
  }

  React.useImperativeHandle(
    ref,
    () => ({
      hasStaged: slots.some((s) => s.kind === "staged"),
      flush: async (pid: number) => {
        const ordered: number[] = [];
        let primaryId: number | null = null;
        for (const s of slots) {
          if (s.kind === "uploaded") {
            ordered.push(s.image.id);
            if (s.image.is_primary) primaryId = s.image.id;
            continue;
          }
          if (s.status === "uploading") continue;
          const image = await uploadStaged(s, pid);
          if (image) {
            ordered.push(image.id);
            if (s.isPrimary) primaryId = image.id;
          }
        }
        if (ordered.length > 1)
          await reorderProductImages(pid, ordered).catch(() => {});
        if (primaryId !== null)
          await setPrimaryImage(pid, primaryId).catch(() => {});
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slots],
  );

  const previewOf = (slot: Slot) =>
    slot.kind === "uploaded" ? (
      <OptimizedImage
        imageKey={slot.image.key}
        alt={slot.alt || "تصویر محصول"}
        width={160}
        className="h-full w-full"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview before upload.
      <img
        src={slot.previewUrl}
        alt="پیش‌نمایش"
        className="h-full w-full object-cover"
      />
    );

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl",
          "border border-dashed border-border bg-input/30 px-4 py-6 text-center text-muted-foreground",
          "transition-colors hover:border-primary/50 hover:text-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
        )}
      >
        <ImagePlus className="size-6" aria-hidden />
        <span className="text-xs">
          برای انتخاب یا کشیدن تصاویر اینجا کلیک کنید
        </span>
        <span className="text-[11px]">
          ۱۰۰۰×۱۲۵۰ پیکسل پیشنهادی · JPG/PNG/WebP/AVIF · حداکثر {MAX_MB}MB
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {slots.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {slots.map((slot, i) => {
            const isPrimary =
              slot.kind === "uploaded" ? slot.image.is_primary : slot.isPrimary;
            const uploading =
              slot.kind === "staged" && slot.status === "uploading";
            const errored = slot.kind === "staged" && slot.status === "error";
            return (
              <li
                key={slot.localId}
                draggable={!uploading}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-2",
                  isPrimary && "ring-1 ring-primary/40",
                  dragIndex === i && "opacity-50",
                )}
              >
                <span
                  aria-hidden
                  className="hidden cursor-grab text-muted-foreground active:cursor-grabbing sm:block"
                >
                  <GripVertical className="size-4" />
                </span>

                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {previewOf(slot)}
                  {uploading ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2
                        className="size-5 animate-spin text-primary"
                        aria-hidden
                      />
                    </span>
                  ) : null}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Input
                    value={slot.alt}
                    onChange={(e) => setAlt(slot, e.target.value)}
                    onBlur={() => commitAlt(slot)}
                    placeholder="متن جایگزین (alt)"
                    aria-label="متن جایگزین تصویر"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{
                          width: `${Math.round((slot.progress || 0) * 100)}%`,
                        }}
                      />
                    </div>
                  ) : errored ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="size-3" aria-hidden />{" "}
                      {slot.error}
                    </p>
                  ) : isPrimary ? (
                    <p className="text-xs text-primary">تصویر اصلی</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-0.5">
                  {errored && live ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="تلاش دوباره"
                      onClick={() =>
                        slot.kind === "staged" && uploadStaged(slot, productId)
                      }
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      isPrimary ? "تصویر اصلی" : "تنظیم به‌عنوان تصویر اصلی"
                    }
                    aria-pressed={isPrimary}
                    disabled={uploading || errored || isPending}
                    onClick={() => makePrimary(slot)}
                  >
                    <Star
                      className={cn(
                        "size-4",
                        isPrimary && "fill-primary text-primary",
                      )}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="حذف تصویر"
                    disabled={uploading || isPending}
                    onClick={() => removeSlot(slot)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
});
