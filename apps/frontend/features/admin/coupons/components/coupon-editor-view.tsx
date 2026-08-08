"use client";

import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CouponApiError, useAdminCoupon } from "@/features/coupons/api";
import { PageHeader } from "@/features/dashboard/components/page-header";

import { CouponFormWithOptions } from "./coupon-form-with-options";

function BackButton() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/admin/coupons">
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );
}

export function CouponCreateView() {
  return (
    <>
      <PageHeader
        title="کد تخفیف جدید"
        description="ارزش، بازهٔ اعتبار و محدودیت‌های مصرف را مشخص کنید."
        actions={<BackButton />}
      />
      <CouponFormWithOptions mode="create" />
    </>
  );
}

export function CouponEditView({ id }: { id: number }) {
  const coupon = useAdminCoupon(id);

  if (coupon.isLoading) {
    return (
      <div
        role="status"
        className="space-y-6"
        aria-label="در حال بارگذاری کد تخفیف"
      >
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 w-full max-w-5xl rounded-2xl" />
      </div>
    );
  }

  if (coupon.isError || !coupon.data) {
    const missing =
      coupon.error instanceof CouponApiError && coupon.error.status === 404;
    return (
      <div
        role="alert"
        className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]"
      >
        <p className="font-serif text-lg">
          {missing ? "کد تخفیف پیدا نشد" : "بارگذاری کد تخفیف ناموفق بود"}
        </p>
        <div className="flex gap-2">
          {!missing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => coupon.refetch()}
            >
              <RotateCw className="size-4" /> تلاش مجدد
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
        title="ویرایش کد تخفیف"
        description={coupon.data.code}
        actions={<BackButton />}
      />
      <CouponFormWithOptions mode="edit" coupon={coupon.data} />
    </>
  );
}
