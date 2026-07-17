"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type { Tag } from "@/features/catalog/tags/types";
import {
  createRecipe,
  RecipeApiError,
  updateRecipe,
} from "@/features/recipes/api/client";
import type {
  AdminRecipeDetail,
  CreateRecipeInput,
  RecipeIngredientInput,
  RecipeProductInput,
} from "@/features/recipes/types";
import {
  recipeFormSchema,
  type RecipeFormValues,
} from "@/features/recipes/validations";
import { ContentSection } from "./recipe-form/ContentSection";
import { GeneralInfoSection } from "./recipe-form/GeneralInfoSection";
import { IngredientsSection } from "./recipe-form/IngredientsSection";
import { RecipeSidebar } from "./recipe-form/RecipeSidebar";
import { SeoSection } from "./recipe-form/SeoSection";
import { ShoppableProductsSection } from "./recipe-form/ShoppableProductsSection";
import { SpecificationsSection } from "./recipe-form/SpecificationsSection";

// Numeric fields are kept as strings in the form and coerced on submit, matching
// product-form.tsx. Empty strings round-trip to the API's optional/zero values.

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
const intOrZero = (v?: string) => (v && v.trim() !== "" ? Number(v) : 0);

function defaults(recipe?: AdminRecipeDetail): RecipeFormValues {
  return {
    title: recipe?.title ?? "",
    slug: recipe?.slug ?? "",
    excerpt: recipe?.excerpt ?? "",
    content: recipe?.content ?? "",
    difficulty: recipe?.difficulty ?? "easy",
    prep_time_minutes: recipe?.prep_time_minutes
      ? String(recipe.prep_time_minutes)
      : "",
    cook_time_minutes: recipe?.cook_time_minutes
      ? String(recipe.cook_time_minutes)
      : "",
    servings: recipe?.servings ? String(recipe.servings) : "",
    status: recipe?.status ?? "draft",
    image_url: recipe?.image_url ?? "",
    is_featured: recipe?.is_featured ?? false,
    meta_title: recipe?.meta_title ?? "",
    meta_description: recipe?.meta_description ?? "",
    tag_ids: (recipe?.tags ?? []).map((t) => t.id),
    ingredients: (recipe?.ingredients ?? []).map((i) => ({
      ingredient_name: i.ingredient_name,
      quantity: i.quantity ?? "",
      unit: i.unit ?? "",
      notes: i.notes ?? "",
      optional: i.optional,
      product_variant_id: i.product_variant_id,
    })),
    products: (recipe?.products ?? []).map((p) => ({
      product_variant_id: p.product_variant_id,
      _label: p.product_title,
      _brand: p.brand ?? null,
      _sku: p.sku ?? null,
      quantity: p.quantity ?? "",
      unit: p.unit ?? "",
      is_primary: p.is_primary,
    })),
  };
}

export function RecipeForm({
  mode,
  recipe,
  tags,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit";
  recipe?: AdminRecipeDetail;
  tags: Tag[];
  submitLabel?: string;
}) {
  const router = useRouter();
  const [imageUploading, setImageUploading] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: defaults(recipe),
  });

  const title = watch("title");
  const imageUrl = watch("image_url");
  const status = watch("status");

  /** Map the (string-keyed, form-shaped) values onto the API payload. */
  function toPayload(v: RecipeFormValues): CreateRecipeInput {
    const ingredients: RecipeIngredientInput[] = v.ingredients.map(
      (ing, idx) => ({
        ingredient_name: ing.ingredient_name.trim(),
        quantity: strOrNull(ing.quantity),
        unit: strOrNull(ing.unit),
        notes: strOrNull(ing.notes),
        optional: ing.optional,
        product_variant_id: ing.product_variant_id,
        sort_order: idx,
      }),
    );
    const products: RecipeProductInput[] = v.products.map((p, idx) => ({
      product_variant_id: p.product_variant_id,
      quantity: strOrNull(p.quantity),
      unit: strOrNull(p.unit),
      is_primary: p.is_primary,
      sort_order: idx,
    }));
    return {
      title: v.title.trim(),
      slug: strOrNull(v.slug),
      excerpt: strOrNull(v.excerpt),
      content: v.content,
      difficulty: v.difficulty,
      prep_time_minutes: intOrZero(v.prep_time_minutes),
      cook_time_minutes: intOrZero(v.cook_time_minutes),
      servings: intOrZero(v.servings) || undefined,
      status: v.status,
      image_url: strOrNull(v.image_url),
      is_featured: v.is_featured,
      meta_title: strOrNull(v.meta_title),
      meta_description: strOrNull(v.meta_description),
      tag_ids: v.tag_ids,
      ingredients,
      products,
    };
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof RecipeApiError) {
      if (e.fields) {
        Object.entries(e.fields).forEach(([key, msgs], index) => {
          setError(
            key as keyof RecipeFormValues,
            { message: msgs[0] },
            { shouldFocus: index === 0 },
          );
        });
      }
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  async function onSubmit(v: RecipeFormValues) {
    try {
      const payload = toPayload(v);
      if (mode === "create") {
        await createRecipe(payload);
        toast.success("دستور ایجاد شد");
      } else if (recipe) {
        await updateRecipe(recipe.id, payload);
        toast.success("تغییرات ذخیره شد");
      }
      router.push("/admin/recipes");
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      noValidate
    >
      <div className="flex flex-col gap-6">
        <GeneralInfoSection register={register} errors={errors} />
        <ContentSection control={control} errors={errors} />
        <SpecificationsSection
          control={control}
          register={register}
          errors={errors}
        />
        <IngredientsSection
          control={control}
          register={register}
          errors={errors}
        />
        <ShoppableProductsSection
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
        />
        <SeoSection register={register} errors={errors} />
      </div>

      <RecipeSidebar
        control={control}
        errors={errors}
        tags={tags}
        title={title}
        imageUrl={imageUrl}
        status={status}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        imageUploading={imageUploading}
        onUploadingChange={setImageUploading}
        onCancel={() => router.push("/admin/recipes")}
      />
    </form>
  );
}
