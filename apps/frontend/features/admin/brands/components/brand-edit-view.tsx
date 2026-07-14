import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBrand } from "@/features/admin/brands/api";
import type { Brand } from "@/features/catalog/brands/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/client";

import { BrandForm } from "./BrandForm";

export async function BrandEditView({ id }: { id: string }) {
  let brand: Brand;
  try {
    brand = await getBrand(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        title="ویرایش برند"
        description={brand.title}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/brands">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <BrandForm mode="edit" brand={brand} submitLabel="ذخیرهٔ تغییرات" />
    </>
  );
}
