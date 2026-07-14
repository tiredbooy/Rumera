"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPT, MAX_MB, RECOMMENDED_DIMENSIONS } from "./constants";

type ImageDropzoneProps = {
  onFilesSelected: (files: FileList | File[]) => void;
  count: number;
  maxImages?: number;
  disabled?: boolean;
};

export function ImageDropzone({
  onFilesSelected,
  count,
  maxImages,
  disabled = false,
}: ImageDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const atLimit = typeof maxImages === "number" && count >= maxImages;
  const unavailable = atLimit || disabled;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={unavailable}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!unavailable) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!unavailable && e.dataTransfer.files.length)
            onFilesSelected(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl",
          "border border-dashed border-border bg-input/30 px-4 py-6 text-center text-muted-foreground",
          "transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
          unavailable
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-primary/50 hover:text-foreground",
          isDragOver && "border-primary bg-primary/5 text-foreground",
        )}
      >
        <ImagePlus className="size-6" aria-hidden />
        <span className="text-xs">
          {atLimit
            ? `حداکثر ${maxImages} تصویر افزوده شده است`
            : "برای انتخاب یا کشیدن تصاویر اینجا کلیک کنید"}
        </span>
        {!atLimit && (
          <span className="text-[11px]">
            {RECOMMENDED_DIMENSIONS} · JPG/PNG/WebP/AVIF · حداکثر {MAX_MB}MB
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
      {typeof maxImages === "number" && (
        <span className="text-left text-[11px] text-muted-foreground">
          {count} از {maxImages} تصویر
        </span>
      )}
    </div>
  );
}
