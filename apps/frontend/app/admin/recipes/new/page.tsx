import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi } from "@/lib/api/client";
import type { Paginated } from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecipeForm } from "@/features/admin/recipes/components/RecipeForm";

type AdminTag = { id: number; title: string };

/** Tag lookups for the form. Empty on failure so the form still renders. */
async function loadTags(): Promise<AdminTag[]> {
  try {
    return (
      (await serverApi<Paginated<AdminTag>>("/tags?limit=200")).results ?? []
    );
  } catch {
    return [];
  }
}

export default async function AdminNewRecipePage() {
  await requirePermission(PERMISSIONS.RECIPES_WRITE);
  const tags = await loadTags();

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
      <RecipeForm mode="create" tags={tags} submitLabel="افزودن دستور" />
    </>
  );
}
