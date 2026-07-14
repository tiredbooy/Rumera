"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listAdminHeroSlides } from "@/features/hero-slides/api/client";
import { HeroForm } from "@/features/admin/hero-slides/components/hero-form";

/**
 * Client-side loader for the hero-slide editor. Fetches the admin slide list
 * through the authenticated BFF proxy (the single-slide GET isn't exposed on the
 * browser client) and resolves the requested slide by id, so inactive/scheduled
 * slides edit correctly. Renders loading / not-found / error states before the
 * form mounts with real defaults.
 */
export function HeroEditLoader({ id }: { id: number }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "hero-slides"],
    queryFn: listAdminHeroSlides,
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

  const slide = data?.find((s) => s.id === id);

  if (!slide) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center">
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

  return <HeroForm mode="edit" slide={slide} submitLabel="ذخیرهٔ تغییرات" />;
}
