"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedImage } from "@/components/optimized-image";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import * as React from "react";
import type { Slot, StagedSlot } from "./product-types";
import { UploadProgressBar } from "./UploadProgressBar";

type ImageSlotItemProps = {
  slot: Slot;
  index: number;
  total: number;
  isPending: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  isPrimary: boolean;
  canRetry: boolean;
  onAltChange: (alt: string) => void;
  onAltCommit: () => void;
  onMakePrimary: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
};

/**
 * One gallery tile (PE-8). The 56px row this replaced was too small to tell two
 * bottle shots apart, which is the one thing the operator is here to do.
 */
export function ImageSlotItem({
  slot,
  index,
  total,
  isPending,
  isDragging,
  isDropTarget,
  isPrimary,
  canRetry,
  onAltChange,
  onAltCommit,
  onMakePrimary,
  onRemove,
  onRetry,
  onMovePrev,
  onMoveNext,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: ImageSlotItemProps) {
  const uploading = slot.kind === "staged" && slot.status === "uploading";
  const errored = slot.kind === "staged" && slot.status === "error";
  const position = `${index + 1} از ${total}`;

  const preview =
    slot.kind === "uploaded" ? (
      <OptimizedImage
        imageKey={slot.image.storage_key}
        src={slot.image.image_url}
        alt={slot.alt || "تصویر محصول"}
        width={480}
        className="h-full w-full object-cover"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- staged local or remote preview before persistence.
      <img
        src={slot.previewUrl}
        alt="پیش‌نمایش"
        className="h-full w-full object-cover"
      />
    );

  return (
    <li
      draggable={!uploading && !isPending}
      aria-posinset={index + 1}
      aria-setsize={total}
      onDragStart={(event) => {
        // Firefox will not start a drag unless dataTransfer.setData runs.
        event.dataTransfer.setData("text/plain", slot.localId);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-2 transition-shadow",
        isPrimary && "border-primary/40 ring-1 ring-primary/40",
        isDropTarget && "ring-2 ring-primary",
        isDragging && "opacity-50",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
        {preview}
        {isPrimary ? (
          <span className="absolute start-1.5 top-1.5 rounded-lg bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
            تصویر اصلی
          </span>
        ) : null}
        <span
          aria-hidden
          className="absolute end-1.5 top-1.5 cursor-grab rounded-lg bg-background/80 p-1 text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          </span>
        )}
      </div>

      <Input
        value={slot.alt}
        maxLength={255}
        onChange={(e) => onAltChange(e.target.value)}
        onBlur={onAltCommit}
        placeholder="متن جایگزین (alt)"
        aria-label={`متن جایگزین تصویر ${index + 1}`}
        disabled={uploading || isPending}
      />

      {uploading ? (
        <UploadProgressBar
          progress={slot.progress || 0}
          label={`پیشرفت بارگذاری تصویر ${index + 1}`}
        />
      ) : errored ? (
        <p
          role="alert"
          className="flex items-start gap-1 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
          {(slot as StagedSlot).error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-0.5">
        {/* The grid reads right-to-left, so «قبلی» sits on the right. Labels
            name the position rather than a direction: in a wrapping grid
            «بالا» would be wrong for every tile but the first of a row. */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-image-reorder={slot.localId}
            data-reorder-direction="prev"
            aria-label={`انتقال تصویر ${position} به جایگاه قبلی`}
            disabled={index === 0 || uploading || isPending}
            onClick={onMovePrev}
            className="rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-image-reorder={slot.localId}
            data-reorder-direction="next"
            aria-label={`انتقال تصویر ${position} به جایگاه بعدی`}
            disabled={index === total - 1 || uploading || isPending}
            onClick={onMoveNext}
            className="rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <div className="flex items-center">
          {errored && canRetry && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`تلاش دوباره برای تصویر ${index + 1}`}
              disabled={isPending}
              onClick={onRetry}
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              isPrimary
                ? `تصویر ${index + 1} اصلی است`
                : `تنظیم تصویر ${index + 1} به‌عنوان تصویر اصلی`
            }
            aria-pressed={isPrimary}
            disabled={isPrimary || uploading || errored || isPending}
            onClick={onMakePrimary}
          >
            <Star
              className={cn("size-4", isPrimary && "fill-primary text-primary")}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`حذف تصویر ${index + 1}`}
            disabled={uploading || isPending}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
