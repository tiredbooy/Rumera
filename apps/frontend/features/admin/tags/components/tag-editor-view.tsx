"use client";

import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TagApiError, useAdminTag } from "@/features/admin/tags/api";
import { PageHeader } from "@/features/dashboard/components/page-header";

import { TagForm } from "./tag-form";

function BackButton() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/admin/tags">
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );
}

export function TagCreateView() {
  return (
    <>
      <PageHeader
        title="برچسب جدید"
        description="یک برچسب قابل استفاده در محصولات و محتوای کاتالوگ بسازید."
        actions={<BackButton />}
      />
      <TagForm mode="create" />
    </>
  );
}

export function TagEditView({ id }: { id: number }) {
  const tag = useAdminTag(id);

  if (tag.isLoading) {
    return (
      <div
        role="status"
        aria-label="در حال بارگذاری برچسب"
        className="space-y-6"
      >
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full max-w-5xl rounded-2xl" />
      </div>
    );
  }

  if (tag.isError || !tag.data) {
    const missing =
      tag.error instanceof TagApiError && tag.error.status === 404;
    return (
      <div
        role="alert"
        className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
      >
        <p className="font-serif text-lg">
          {missing ? "برچسب پیدا نشد" : "بارگذاری برچسب ناموفق بود"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {!missing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => tag.refetch()}
              disabled={tag.isFetching}
            >
              <RotateCw
                className={tag.isFetching ? "size-4 animate-spin" : "size-4"}
              />
              تلاش مجدد
            </Button>
          ) : null}
          <BackButton />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="ویرایش برچسب"
        description={tag.data.title}
        actions={<BackButton />}
      />
      <TagForm mode="edit" tag={tag.data} />
    </>
  );
}
