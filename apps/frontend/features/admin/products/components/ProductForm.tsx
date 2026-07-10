"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTransition } from "react";

import type { ProductDetail } from "@/lib/catalog/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { ImageUploaderHandle } from "@/components/admin/image-uploader";

import {
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  deleteVariant,
} from "@/features/admin/products/actions";

import type {
  CreateProductReq,
  UpdateProductReq,
} from "@/features/admin/products/types";

import {
  productFormSchema,
  getDefaultFormValues,
  strOrNull,
  numOrNull,
  parseTags,
  type ProductFormValues,
} from "../validations";
import type { AdminTag } from "./product-form/TagSelector";

import { FormHeaderBar } from "./product-form/sidebar/FormHeaderBar";
import { MobileActionBar } from "./product-form/sidebar/MobileActionBar";
import { PreviewCard } from "./product-form/sidebar/PreviewCard";
import { GeneralInfoSection } from "./product-form/GeneralInfoSection";
import { SpecificationsSection } from "./product-form/SpecificationsSection";
import { VariantsSection } from "./product-form/VariantsSection";
import { ImagesSection } from "./product-form/ImagesSection";
import { SeoSection } from "./product-form/SeoSection";
import { CategoryResponse } from "@/features/catalog/categories/types";

// ── Payload helpers ─────────────────────────────────────────────

function toCreatePayload(v: ProductFormValues): CreateProductReq {
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

function toUpdatePayload(v: ProductFormValues): UpdateProductReq {
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
  tags,
}: {
  mode: "create" | "edit";
  product?: ProductDetail;
  categories: CategoryResponse[];
  brands: Brand[];
  tags: AdminTag[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const uploaderRef = React.useRef<ImageUploaderHandle>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: getDefaultFormValues(product),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const title = watch("title");
  const brandId = watch("brand_id");
  const isActive = watch("is_active");
  const brandName = brands.find((b) => String(b.id) === brandId)?.title;

  const primaryImage =
    product?.images?.find((i) => i.is_primary) ?? product?.images?.[0];

  function applyServerErrors(e: unknown) {
    const message = e instanceof Error ? e.message : "خطای غیرمنتظره رخ داد";
    toast.error(message);
  }

  async function onSubmit(v: ProductFormValues) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          // ✅ Use the imported server action (no "Action" suffix)
          const created = await createProduct(toCreatePayload(v));

          // Create variants one-by-one
          for (const vr of v.variants) {
            await createVariant(created.id, {
              sku: strOrNull(vr.sku),
              price: Number(vr.price),
              compare_at_price: numOrNull(vr.compare_at_price),
            });
          }

          // Upload staged images
          await uploaderRef.current?.flush(created.id);
          toast.success("محصول ایجاد شد");
          router.push(`/admin/products/${created.id}`);
          router.refresh();
          return;
        }

        if (!product) return;

        await updateProduct(product.id, toUpdatePayload(v));

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
          const body = {
            sku: strOrNull(vr.sku),
            price: Number(vr.price),
            compare_at_price: numOrNull(vr.compare_at_price),
          };
          if (vr._id) await updateVariant(vr._id, body);
          else await createVariant(product.id, body);
        }

        await uploaderRef.current?.flush(product.id);
        toast.success("تغییرات ذخیره شد");
        router.refresh();
      } catch (e) {
        applyServerErrors(e);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <FormHeaderBar
        mode={mode}
        title={title}
        control={control}
        isSubmitting={isPending}
        onCancel={() => router.push("/admin/products")}
      />

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
            productId={product?.id}
            mode={mode}
          />
          <SeoSection
            register={register}
            control={control}
            errors={errors}
            tags={tags}
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
