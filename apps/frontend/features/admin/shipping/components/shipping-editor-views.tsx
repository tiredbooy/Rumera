"use client";

import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/dashboard/components/page-header";
import {
  ShippingApiError,
  useAdminShippingMethod,
  useAdminShippingZone,
} from "@/features/shipping/api";

import { ShippingMethodForm } from "./shipping-method-form";
import { ShippingMethodsPanel } from "./shipping-methods-panel";
import { ShippingZoneForm } from "./shipping-zone-form";

function BackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );
}

function EditorLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-72 w-full max-w-5xl rounded-2xl" />
    </div>
  );
}

function EditorError({
  missing,
  message,
  backHref,
  onRetry,
}: {
  missing: boolean;
  message: string;
  backHref: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-hairline flex flex-col items-center gap-4 rounded-2xl bg-card px-5 py-14 text-center ring-1 ring-foreground/[0.04]"
    >
      <p className="font-serif text-lg">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {!missing && onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="size-4" /> تلاش مجدد
          </Button>
        ) : null}
        <BackButton href={backHref} />
      </div>
    </div>
  );
}

export function ShippingZoneCreateView() {
  return (
    <>
      <PageHeader
        title="منطقهٔ ارسال جدید"
        description="محدودهٔ جغرافیایی را تعریف کنید؛ پس از ساخت می‌توانید روش‌های ارسال را اضافه کنید."
        actions={<BackButton href="/admin/shipping" />}
      />
      <ShippingZoneForm mode="create" />
    </>
  );
}

export function ShippingZoneEditView({ id }: { id: number }) {
  const zone = useAdminShippingZone(id);

  if (zone.isLoading) {
    return <EditorLoading label="در حال بارگذاری منطقهٔ ارسال" />;
  }
  if (zone.isError || !zone.data) {
    const missing =
      zone.error instanceof ShippingApiError && zone.error.status === 404;
    return (
      <EditorError
        missing={missing}
        message={
          missing ? "منطقهٔ ارسال پیدا نشد" : "بارگذاری منطقهٔ ارسال ناموفق بود"
        }
        backHref="/admin/shipping"
        onRetry={() => void zone.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="ویرایش منطقهٔ ارسال"
        description={zone.data.name}
        actions={<BackButton href="/admin/shipping" />}
      />
      <ShippingZoneForm mode="edit" zone={zone.data} />
      <ShippingMethodsPanel zoneID={zone.data.id} />
    </>
  );
}

export function ShippingMethodCreateView({ zoneID }: { zoneID: number }) {
  const zone = useAdminShippingZone(zoneID);
  const backHref = `/admin/shipping/${zoneID}`;

  if (zone.isLoading) {
    return <EditorLoading label="در حال بارگذاری منطقهٔ ارسال" />;
  }
  if (zone.isError || !zone.data) {
    const missing =
      zone.error instanceof ShippingApiError && zone.error.status === 404;
    return (
      <EditorError
        missing={missing}
        message={
          missing ? "منطقهٔ ارسال پیدا نشد" : "بارگذاری منطقهٔ ارسال ناموفق بود"
        }
        backHref="/admin/shipping"
        onRetry={() => void zone.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="روش ارسال جدید"
        description={`منطقهٔ ${zone.data.name}`}
        actions={<BackButton href={backHref} />}
      />
      <ShippingMethodForm mode="create" zoneID={zoneID} />
    </>
  );
}

export function ShippingMethodEditView({
  zoneID,
  methodID,
}: {
  zoneID: number;
  methodID: number;
}) {
  const zone = useAdminShippingZone(zoneID);
  const method = useAdminShippingMethod(methodID);
  const backHref = `/admin/shipping/${zoneID}`;

  if (zone.isLoading || method.isLoading) {
    return <EditorLoading label="در حال بارگذاری روش ارسال" />;
  }
  if (zone.isError || method.isError || !zone.data || !method.data) {
    const missing =
      (zone.error instanceof ShippingApiError && zone.error.status === 404) ||
      (method.error instanceof ShippingApiError && method.error.status === 404);
    return (
      <EditorError
        missing={missing}
        message={
          missing
            ? "روش یا منطقهٔ ارسال پیدا نشد"
            : "بارگذاری روش ارسال ناموفق بود"
        }
        backHref={backHref}
        onRetry={() => {
          void zone.refetch();
          void method.refetch();
        }}
      />
    );
  }
  if (method.data.shipping_zone_id !== zoneID) {
    return (
      <EditorError
        missing
        message="روش ارسال متعلق به این منطقه نیست"
        backHref={backHref}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="ویرایش روش ارسال"
        description={`${method.data.name} · منطقهٔ ${zone.data.name}`}
        actions={<BackButton href={backHref} />}
      />
      <ShippingMethodForm mode="edit" zoneID={zoneID} method={method.data} />
    </>
  );
}
