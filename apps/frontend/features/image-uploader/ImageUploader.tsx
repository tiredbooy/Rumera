"use client";

import * as React from "react";
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
      />

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
