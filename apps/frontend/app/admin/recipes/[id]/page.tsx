import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi, ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/catalog/types";
import type { RecipeDetail } from "@/lib/recipes";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecipeForm } from "@/features/admin/recipes/components/RecipeForm";

type AdminTag = { id: number; title: string };

async function loadTags(): Promise<AdminTag[]> {
  try {
    return (
      (await serverApi<Paginated<AdminTag>>("/tags?limit=200")).results ?? []
    );
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

  let recipe: RecipeDetail;
  try {
    // Admin detail is hydrated with ingredients/products/tags and includes drafts.
    recipe = await serverApi<RecipeDetail>(`/admin/recipes/${id}`);
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
