import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchLookupList } from "@/features/admin/shared/fetch-lookup-list";
import type { Tag } from "@/features/catalog/tags/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { getAdminRecipe } from "@/features/recipes/api/server";
import type { AdminRecipeDetail } from "@/features/recipes/types";
import { ApiError } from "@/lib/api/client";

import { RecipeForm } from "./RecipeForm";

export async function RecipeCreateView() {
  const tags = await fetchLookupList<Tag>(
    "/tags?limit=100&sortBy=title&orderBy=asc",
  );

  return (
    <>
      <PageHeader
        title="دستور جدید"
        description="یک کوکتل یا محتوای آموزشی تازه بنویسید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/recipes">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <RecipeForm
        mode="create"
        canWrite
        tags={tags}
        submitLabel="ساخت دستور"
      />
    </>
  );
}

export async function RecipeEditView({
  id,
  canWrite,
}: {
  id: string;
  canWrite: boolean;
}) {
  let recipe: AdminRecipeDetail;
  try {
    // Admin detail hydrates ingredients, products, and tags and includes drafts.
    recipe = await getAdminRecipe(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const tags = await fetchLookupList<Tag>(
    "/tags?limit=100&sortBy=title&orderBy=asc",
  );

  return (
    <>
      <PageHeader
        title="ویرایش دستور"
        description={recipe.title}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/recipes">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <RecipeForm
        mode="edit"
        canWrite={canWrite}
        recipe={recipe}
        tags={tags}
        submitLabel="ذخیرهٔ تغییرات"
      />
    </>
  );
}
