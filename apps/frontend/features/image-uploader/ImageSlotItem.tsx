"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedImage } from "@/components/admin/optimized-image";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import * as React from "react";
import type { Slot, StagedSlot } from "./types";
import { UploadProgressBar } from "./UploadProgressBar";

type ImageSlotItemProps = {
  slot: Slot;
  index: number;
  total: number;
  isPending: boolean;
  isDragging: boolean;
  isPrimary: boolean;
  canRetry: boolean;
  onAltChange: (alt: string) => void;
  onAltCommit: () => void;
  onMakePrimary: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
};

export function ImageSlotItem({
  slot,
  index,
  total,
  isPending,
  isDragging,
  isPrimary,
  canRetry,
  onAltChange,
  onAltCommit,
  onMakePrimary,
  onRemove,
  onRetry,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: ImageSlotItemProps) {
  const uploading = slot.kind === "staged" && slot.status === "uploading";
  const errored = slot.kind === "staged" && slot.status === "error";

  const preview =
    slot.kind === "uploaded" ? (
      <OptimizedImage
        imageKey={slot.image.storage_key}
        src={slot.image.image_url}
        alt={slot.alt || "تصویر محصول"}
        width={160}
        className="h-full w-full object-cover"
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
    <li
      draggable={!uploading && !isPending}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-2 transition-shadow",
        isPrimary && "ring-1 ring-primary/40",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          aria-label="جابه‌جایی به بالا"
          disabled={index === 0 || uploading || isPending}
          onClick={onMoveUp}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <span
          aria-hidden
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </span>
        <button
          type="button"
          aria-label="جابه‌جایی به پایین"
          disabled={index === total - 1 || uploading || isPending}
          onClick={onMoveDown}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {preview}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Input
          value={slot.alt}
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
            className="flex items-center gap-1 text-xs text-destructive"
          >
            <AlertCircle className="size-3" aria-hidden />{" "}
            {(slot as StagedSlot).error}
          </p>
        ) : isPrimary ? (
          <p className="text-xs text-primary">تصویر اصلی</p>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        {errored && canRetry && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="تلاش دوباره"
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
          aria-label={isPrimary ? "تصویر اصلی" : "تنظیم به‌عنوان تصویر اصلی"}
          aria-pressed={isPrimary}
          disabled={uploading || errored || isPending}
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
          aria-label="حذف تصویر"
          disabled={uploading || isPending}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
