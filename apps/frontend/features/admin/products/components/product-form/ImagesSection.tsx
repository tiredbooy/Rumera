"use client";

import * as React from "react";
import { ImageIcon } from "lucide-react";
import { ImageUploader } from "@/features/image-uploader/ImageUploader";
import type { ProductImageUploaderHandle } from "@/features/image-uploader/types";
import type { ProductGallerySnapshot } from "@/features/image-uploader/product-types";
import type { ProductImage } from "@/features/catalog/products/types";
import { FormSection } from "./FormLayout";

export function ImagesSection({
  uploaderRef,
  productId,
  mode,
  initialImages,
  disabled,
  error,
  onDirtyChange,
  onGalleryChange,
}: {
  uploaderRef: React.Ref<ProductImageUploaderHandle>;
  productId: number | null | undefined;
  mode: "create" | "edit";
  initialImages: ProductImage[];
  disabled?: boolean;
  error?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  onGalleryChange?: (gallery: ProductGallerySnapshot) => void;
}) {
  const [gallery, setGallery] = React.useState<ProductGallerySnapshot>(() => {
    const primary =
      initialImages.find((image) => image.is_primary) ?? initialImages[0];
    return { count: initialImages.length, primaryUrl: primary?.image_url };
  });
  const handleGalleryChange = React.useCallback(
    (next: ProductGallerySnapshot) => {
      setGallery(next);
      onGalleryChange?.(next);
    },
    [onGalleryChange],
  );

  return (
    <FormSection
      sectionId="product-images"
      title="تصاویر محصول"
      description="تغییرات تصاویر همراه با ذخیرهٔ محصول ثبت می‌شوند"
      icon={<ImageIcon />}
      collapsible
      defaultOpen={gallery.count > 0}
      hasError={Boolean(error)}
      summary={
        gallery.count > 0
          ? `${gallery.count.toLocaleString("fa-IR")} تصویر`
          : "بدون تصویر"
      }
    >
      <div className="sm:col-span-2">
        {error ? (
          <p role="alert" className="mb-3 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <ImageUploader
          ref={uploaderRef}
          owner={{
            ownerType: "products",
            role: "gallery",
            ownerId: mode === "edit" ? productId : null,
          }}
          deferred
          initialImages={initialImages}
          disabled={disabled}
          onDirtyChange={onDirtyChange}
          onGalleryChange={handleGalleryChange}
        />
      </div>
    </FormSection>
  );
}
