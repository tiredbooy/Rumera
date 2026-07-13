import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ApiError } from "@/lib/api/client";
import type { Tag } from "@/features/catalog/tags/types";
import { listTags } from "@/features/catalog/tags/api/public";
import { getAdminRecipe } from "@/features/recipes/api/server";
import type { AdminRecipeDetail } from "@/features/recipes/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { RecipeForm } from "@/features/admin/recipes/components/RecipeForm";

async function loadTags(): Promise<Tag[]> {
  try {
    return (await listTags({ limit: 200 })).results ?? [];
  } catch {
    return [];
  }
}

export default async function AdminEditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.RECIPES_READ);
  const { id } = await params;

  let recipe: AdminRecipeDetail;
  try {
    // Admin detail is hydrated with ingredients/products/tags and includes drafts.
    recipe = await getAdminRecipe(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const tags = await loadTags();

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
        recipe={recipe}
        tags={tags}
        submitLabel="ذخیرهٔ تغییرات"
      />
    </>
  );
}
