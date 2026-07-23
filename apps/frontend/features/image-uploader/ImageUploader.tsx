"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "./ImageDropzone";
import { ImageSlotList } from "./ImageSlotList";
import { useImageUploader } from "./use-image-uploader";
import type { ImageUploaderHandle } from "./types";
import type { ProductImageUploaderProps } from "./product-types";

export const ImageUploader = React.forwardRef<
  ImageUploaderHandle<void>,
  ProductImageUploaderProps
>(function ImageUploader(
  { owner, initialImages = [], maxImages, disabled = false },
  ref,
) {
  const productId = owner.ownerId;
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
    validate,
  } = useImageUploader({ owner, initialImages, maxImages, disabled });
  const [imageURL, setImageURL] = React.useState("");
  const unavailable = disabled || isPending;

  React.useImperativeHandle(
    ref,
    () => ({ hasStaged, isBusy: isPending, validate, flush }),
    [flush, hasStaged, isPending, validate],
  );

  return (
    <div className="flex flex-col gap-3">
      <ImageDropzone
        onFilesSelected={addFiles}
        count={slots.length}
        maxImages={maxImages}
        disabled={unavailable}
      />

      <div className="flex items-center gap-2">
        <Input
          dir="ltr"
          inputMode="url"
          value={imageURL}
          disabled={unavailable}
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
          disabled={unavailable || imageURL.trim() === ""}
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
        isPending={unavailable}
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
