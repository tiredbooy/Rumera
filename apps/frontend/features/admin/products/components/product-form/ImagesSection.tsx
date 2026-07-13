"use client";

import { ImageIcon } from "lucide-react";
import type { Ref } from "react";
import { ImageUploader } from "@/features/image-uploader/ImageUploader";
import type { ImageUploaderHandle } from "@/features/image-uploader/types";
import type { ProductImage } from "@/features/catalog/products/types";

export function ImagesSection({
  uploaderRef,
  productId,
  mode,
  initialImages,
}: {
  uploaderRef: Ref<ImageUploaderHandle>;
  productId: number | null | undefined;
  mode: "create" | "edit";
  initialImages: ProductImage[];
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="flex items-center gap-2 px-1 font-serif text-base">
        <ImageIcon className="size-4 text-muted-foreground" />
        تصاویر محصول
      </legend>
      {mode === "create" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          تصاویر پس از ذخیرهٔ محصول بارگذاری می‌شوند.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          تغییرات تصاویر در همین بخش بلافاصله ذخیره می‌شوند.
        </p>
      )}
      <div className="mt-4">
        <ImageUploader
          ref={uploaderRef}
          productId={mode === "edit" ? productId : null}
          initialImages={initialImages}
        />
      </div>
    </fieldset>
  );
}
