"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "./ImageDropzone";
import { ImageSlotList } from "./ImageSlotList";
import { useImageUploader } from "./use-image-uploader";
import type { ImageUploaderHandle, ImageUploaderProps } from "./types";

export const ImageUploader = React.forwardRef<
  ImageUploaderHandle,
  ImageUploaderProps
>(function ImageUploader({ productId, initialImages = [], maxImages }, ref) {
  const live = typeof productId === "number" && productId > 0;
  const {
    slots,
    isPending,
    limitMessage,
    announcement,
    addFiles,
    addURL,
    removeSlot,
    makePrimary,
    setAlt,
    commitAlt,
    move,
    moveUp,
    moveDown,
    retryUpload,
    flush,
    hasStaged,
  } = useImageUploader({ productId, initialImages, maxImages });
  const [imageURL, setImageURL] = React.useState("");

  React.useImperativeHandle(ref, () => ({ hasStaged, flush }), [
    hasStaged,
    flush,
  ]);

  return (
    <div className="flex flex-col gap-3">
      <ImageDropzone
        onFilesSelected={addFiles}
        count={slots.length}
        maxImages={maxImages}
        disabled={isPending}
      />

      <div className="flex items-center gap-2">
        <Input
          dir="ltr"
          inputMode="url"
          value={imageURL}
          disabled={isPending}
          aria-label="نشانی تصویر محصول"
          placeholder="https://images.example/product.webp"
          onChange={(event) => setImageURL(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (addURL(imageURL)) setImageURL("");
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending || imageURL.trim() === ""}
          onClick={() => {
            if (addURL(imageURL)) setImageURL("");
          }}
        >
          <Link2 className="size-4" aria-hidden />
          افزودن نشانی
        </Button>
      </div>

      {limitMessage && (
        <p role="alert" className="text-xs text-destructive">
          {limitMessage}
        </p>
      )}

      <ImageSlotList
        slots={slots}
        isPending={isPending}
        live={live}
        onAltChange={setAlt}
        onAltCommit={commitAlt}
        onMakePrimary={makePrimary}
        onRemove={removeSlot}
        onRetry={retryUpload}
        onMove={move}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
      />

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
});
