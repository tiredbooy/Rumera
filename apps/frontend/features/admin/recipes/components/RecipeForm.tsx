"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type { Tag } from "@/features/catalog/tags/types";
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import {
  createRecipe,
  deleteRecipe,
  RecipeApiError,
  updateRecipe,
} from "@/features/recipes/api/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    image_alt: recipe?.image_alt ?? "",
    og_image_url: recipe?.og_image_url ?? "",
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
  const coverMediaRef =
    React.useRef<ImageUploaderHandle<UploadedImage | null>>(null);
  const ogMediaRef =
    React.useRef<ImageUploaderHandle<UploadedImage | null>>(null);
  const [coverPreview, setCoverPreview] = React.useState(
    recipe?.image_url ?? "",
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isDeleting, startDelete] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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
  const imageAlt = watch("image_alt");
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
      image_alt: strOrNull(v.image_alt),
      og_image_url: strOrNull(v.og_image_url),
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
    } else if (e instanceof Error) {
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  function confirmDelete() {
    if (!recipe || isDeleting) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        await deleteRecipe(recipe.id);
        setConfirmDeleteOpen(false);
        toast.success(`«${recipe.title}» حذف شد`);
        router.push("/admin/recipes");
        router.refresh();
      } catch (e) {
        const message =
          e instanceof RecipeApiError
            ? e.message
            : "حذف دستور ناموفق بود. دوباره تلاش کنید.";
        setDeleteError(message);
        toast.error(message);
      }
    });
  }

  async function onSubmit(v: RecipeFormValues) {
    let savedOwnerId: number | null = null;
    try {
      const coverMediaError = coverMediaRef.current?.validate() ?? null;
      const ogMediaError = ogMediaRef.current?.validate() ?? null;
      if (coverMediaError || ogMediaError) {
        const field = coverMediaError ? "image_url" : "og_image_url";
        setError(
          field,
          { message: coverMediaError ?? ogMediaError ?? "تصویر معتبر نیست" },
          { shouldFocus: true },
        );
        return;
      }
      const payload = toPayload(v);
      const coverStaged = coverMediaRef.current?.hasStaged ?? false;
      const publishAfterCover =
        v.status === "published" && coverStaged && !recipe?.image_url;
      if (coverStaged) {
        payload.image_url = mode === "create" ? null : undefined;
        payload.image_alt = undefined;
      }
      if (ogMediaRef.current?.hasStaged) {
        payload.og_image_url = mode === "create" ? null : undefined;
      }
      if (publishAfterCover) payload.status = "draft";

      let saved: AdminRecipeDetail;
      if (mode === "create") {
        saved = await createRecipe(payload);
      } else if (recipe) {
        saved = await updateRecipe(recipe.id, payload);
      } else {
        return;
      }
      savedOwnerId = saved.id;
      await coverMediaRef.current?.flush(saved.id);
      await ogMediaRef.current?.flush(saved.id);
      if (publishAfterCover) {
        await updateRecipe(saved.id, { status: "published" });
      }
      toast.success(mode === "create" ? "دستور ایجاد شد" : "تغییرات ذخیره شد");
      router.push("/admin/recipes");
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
      if (mode === "create" && savedOwnerId) {
        toast.info("دستور ذخیره شد؛ بارگذاری را در صفحه ویرایش ادامه دهید");
        router.push(`/admin/recipes/${savedOwnerId}`);
        router.refresh();
      }
    }
  }

  return (
    <>
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
          <SeoSection
            control={control}
            register={register}
            errors={errors}
            ownerId={recipe?.id}
            mediaRef={ogMediaRef}
            disabled={isSubmitting || isDeleting}
          />
        </div>

        <RecipeSidebar
          control={control}
          errors={errors}
          tags={tags}
          title={title}
          imageUrl={coverPreview}
          imageAlt={imageAlt}
          status={status}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          ownerId={recipe?.id}
          mediaRef={coverMediaRef}
          onPreviewChange={setCoverPreview}
          disabled={isSubmitting || isDeleting}
          onCancel={() => router.push("/admin/recipes")}
          canDelete={mode === "edit" && Boolean(recipe)}
          isDeleting={isDeleting}
          onDelete={() => {
            setDeleteError(null);
            setConfirmDeleteOpen(true);
          }}
        />
      </form>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setConfirmDeleteOpen(open);
            if (!open) setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دستور</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{recipe?.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست
              و دستور از فروشگاه و پنل مدیریت حذف می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel size="lg" disabled={isDeleting}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="lg"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? "در حال حذف…" : "تأیید حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
