"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTransition } from "react";

import type { ProductDetail } from "@/features/catalog/products/types";
import type { Brand } from "@/features/catalog/brands/types";
import { syncProductTags } from "@/features/admin/tags/api";

import {
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  deleteVariant,
} from "@/features/admin/products/actions/product";

import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductVariantInput,
} from "@/features/admin/products/types";

import {
  productFormSchema,
  getDefaultFormValues,
  strOrNull,
  numOrNull,
  parseTags,
  type ProductFormValues,
} from "../validations";

import { FormHeaderBar } from "./product-form/sidebar/FormHeaderBar";
import { MobileActionBar } from "./product-form/sidebar/MobileActionBar";
import { PreviewCard } from "./product-form/sidebar/PreviewCard";
import { GeneralInfoSection } from "./product-form/GeneralInfoSection";
import { SpecificationsSection } from "./product-form/SpecificationsSection";
import { VariantsSection } from "./product-form/VariantsSection";
import { ImagesSection } from "./product-form/ImagesSection";
import { SeoSection } from "./product-form/SeoSection";
import type { Category } from "@/features/catalog/categories/types";
import type { ImageUploaderHandle } from "@/features/image-uploader/types";

// ── Payload helpers ─────────────────────────────────────────────

function toCreatePayload(v: ProductFormValues): CreateProductInput {
  return {
    title: v.title.trim(),
    code: strOrNull(v.code),
    slug: strOrNull(v.slug),
    category_id: numOrNull(v.category_id),
    description: strOrNull(v.description),
    brand_id: numOrNull(v.brand_id),
    country_of_origin: strOrNull(v.country_of_origin),
    abv: numOrNull(v.abv),
    weight: numOrNull(v.weight),
    meta_title: strOrNull(v.meta_title),
    meta_description: strOrNull(v.meta_description),
    meta_tags: parseTags(v.meta_tags),
    tag_ids: v.tag_ids,
    variants: [], // we'll create them separately
  };
}

function toUpdatePayload(v: ProductFormValues): UpdateProductInput {
  return {
    title: v.title.trim(),
    code: strOrNull(v.code),
    slug: strOrNull(v.slug),
    category_id: numOrNull(v.category_id),
    description: strOrNull(v.description),
    brand_id: numOrNull(v.brand_id),
    country_of_origin: strOrNull(v.country_of_origin),
    abv: numOrNull(v.abv),
    weight: numOrNull(v.weight),
    is_active: v.is_active,
    meta_title: strOrNull(v.meta_title),
    meta_description: strOrNull(v.meta_description),
    meta_tags: parseTags(v.meta_tags),
    tag_ids: v.tag_ids,
  };
}

// ── Component ────────────────────────────────────────────────────

export function ProductForm({
  mode,
  product,
  categories,
  brands,
}: {
  mode: "create" | "edit";
  product?: ProductDetail;
  categories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const uploaderRef = React.useRef<ImageUploaderHandle<void>>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultFormValues(product),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const title = useWatch({ control, name: "title" });
  const brandId = useWatch({ control, name: "brand_id" });
  const isActive = useWatch({ control, name: "is_active" });
  const brandName = brands.find((b) => String(b.id) === brandId)?.title;

  const primaryImage =
    product?.images?.find((i) => i.is_primary) ?? product?.images?.[0];

  function applyServerErrors(e: unknown) {
    const message = e instanceof Error ? e.message : "خطای غیرمنتظره رخ داد";
    setSaveError(message);
    toast.error(message);
  }

  function onSubmit(
    v: ProductFormValues,
    uploader: ImageUploaderHandle<void> | null,
  ) {
    const mediaError = uploader?.validate();
    if (mediaError) {
      applyServerErrors(new Error(mediaError));
      return;
    }
    startTransition(async () => {
      setSaveError(null);
      try {
        if (mode === "create") {
          const created = await createProduct(toCreatePayload(v));

          try {
            await syncProductTags(created.id, { tag_ids: v.tag_ids });
          } catch (error) {
            const detail = error instanceof Error ? `: ${error.message}` : "";
            const message =
              "محصول ایجاد شد، اما برچسب‌ها ذخیره نشدند و گونه‌ها و تصاویر هنوز ذخیره نشده‌اند" +
              detail;
            setSaveError(message);
            toast.error(message);
            router.push(`/admin/products/${created.id}`);
            router.refresh();
            return;
          }

          // Create variants one-by-one
          for (const vr of v.variants) {
            await createVariant(created.id, {
              sku: strOrNull(vr.sku),
              price: Number(vr.price),
              compare_at_price: numOrNull(vr.compare_at_price),
              option_value_ids: vr.option_value_ids,
            });
          }

          try {
            await uploader?.flush(created.id);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? `محصول ایجاد شد، اما تصاویر کامل ذخیره نشدند: ${error.message}`
                : "محصول ایجاد شد، اما تصاویر کامل ذخیره نشدند.",
            );
            router.push(`/admin/products/${created.id}`);
            router.refresh();
            return;
          }
          toast.success("محصول ایجاد شد");
          router.push(`/admin/products/${created.id}`);
          router.refresh();
          return;
        }

        if (!product) return;

        await updateProduct(product.id, toUpdatePayload(v));
        try {
          await syncProductTags(product.id, { tag_ids: v.tag_ids });
        } catch (error) {
          const detail = error instanceof Error ? `: ${error.message}` : "";
          throw new Error(
            "اطلاعات پایهٔ محصول ذخیره شد، اما برچسب‌ها، گونه‌ها و تصاویر ذخیره نشدند" +
              detail,
          );
        }

        // Reconcile variants: delete removed, update existing, create new
        const original = product.variants ?? [];
        const kept = new Set(
          v.variants.filter((vr) => vr._id).map((vr) => vr._id),
        );
        await Promise.all(
          original
            .filter((ov) => !kept.has(ov.id))
            .map((ov) => deleteVariant(ov.id)),
        );
        for (const vr of v.variants) {
          const body: UpdateProductVariantInput = {
            sku: strOrNull(vr.sku),
            price: Number(vr.price),
            compare_at_price: numOrNull(vr.compare_at_price),
          };
          if (vr._id) await updateVariant(vr._id, body);
          else
            await createVariant(product.id, {
              ...body,
              price: body.price ?? 0,
              option_value_ids: vr.option_value_ids,
            });
        }

        await uploader?.flush(product.id);
        toast.success("تغییرات ذخیره شد");
        router.refresh();
      } catch (e) {
        applyServerErrors(e);
      }
    });
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const uploader = uploaderRef.current;
    void handleSubmit((values) => onSubmit(values, uploader))(event);
  }

  return (
    <form
      onSubmit={onFormSubmit}
      aria-busy={isPending || undefined}
      className="flex flex-col"
    >
      <FormHeaderBar
        mode={mode}
        title={title}
        control={control}
        isSubmitting={isPending}
        onCancel={() => router.push("/admin/products")}
      />

      {saveError ? (
        <p
          role="alert"
          className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <GeneralInfoSection
            register={register}
            control={control}
            errors={errors}
            categories={categories}
            brands={brands}
          />
          <SpecificationsSection register={register} errors={errors} />
          <VariantsSection
            register={register}
            errors={errors}
            fields={fields}
            append={append}
            remove={remove}
          />

          <ImagesSection
            uploaderRef={uploaderRef}
            productId={product?.id ?? null}
            mode={mode}
            initialImages={product?.images ?? []}
            disabled={isPending}
          />

          <SeoSection
            register={register}
            control={control}
            errors={errors}
            initialTags={product?.tags}
            disabled={isPending}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <div className="lg:sticky lg:top-20">
            <PreviewCard
              imageUrl={primaryImage?.image_url}
              title={title}
              brandName={brandName}
              isActive={isActive}
              mode={mode}
            />
          </div>
        </aside>
      </div>

      <MobileActionBar
        mode={mode}
        control={control}
        isSubmitting={isPending}
        onCancel={() => router.push("/admin/products")}
      />
    </form>
  );
}
