"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAdminHeroSlide,
  HeroSlideApiError,
} from "@/features/hero-slides/api/client";
import { HeroForm } from "@/features/admin/hero-slides/components/hero-form";

/**
 * Client-side loader for the hero-slide editor. Fetches the requested admin
 * projection through the authenticated BFF and renders explicit loading,
 * not-found, and retryable error states before mounting the form.
 */
export function HeroEditLoader({ id }: { id: number }) {
  const {
    data: slide,
    error,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin", "hero-slides", id],
    queryFn: () => getAdminHeroSlide(id),
    retry: (failureCount, requestError) =>
      !(
        requestError instanceof HeroSlideApiError && requestError.status === 404
      ) && failureCount < 3,
  });

  if (isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const notFound =
    (isError && error instanceof HeroSlideApiError && error.status === 404) ||
    (!isPending && !isError && !slide);

  if (notFound) {
    return (
      <div
        role="status"
        className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
          <SearchX className="size-6" />
        </span>
        <p className="font-serif text-base">اسلاید پیدا نشد</p>
        <p className="text-sm text-muted-foreground">
          ممکن است این اسلاید حذف شده باشد.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/hero-slides">بازگشت به فهرست</Link>
        </Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </span>
        <p className="font-serif text-base">بارگذاری اسلاید ناموفق بود</p>
        <p className="text-sm text-muted-foreground">لطفاً دوباره تلاش کنید.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" /> تلاش دوباره
        </Button>
      </div>
    );
  }

  if (!slide) {
    return null;
  }

  return <HeroForm mode="edit" slide={slide} submitLabel="ذخیرهٔ تغییرات" />;
}
