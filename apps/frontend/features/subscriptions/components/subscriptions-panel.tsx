import { PackageOpen, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Address } from "@/features/addresses/types";
import type { Subscription } from "@/features/subscriptions/types";
import { SubscriptionCard } from "./subscription-card";

type SubscriptionsPanelProps = {
  subscriptions: Subscription[];
  addresses: Address[];
  addressById: ReadonlyMap<number, Address>;
  busyId: number | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRequestSkip: (id: number) => void;
  onResume: (id: number) => void;
  onRequestPause: (id: number) => void;
  onRequestCancel: (id: number) => void;
  onChangeAddress: (id: number, addressId: number) => void;
};

export function SubscriptionsPanel({
  subscriptions,
  addresses,
  addressById,
  busyId,
  isLoading,
  isError,
  onRetry,
  onRequestSkip,
  onResume,
  onRequestPause,
  onRequestCancel,
  onChangeAddress,
}: SubscriptionsPanelProps) {
  if (isLoading) {
    return (
      <div
        className="flex flex-col gap-3"
        aria-busy="true"
        aria-label="در حال بارگذاری اشتراک‌ها"
      >
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/40 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <PackageOpen className="size-6" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">
          خطا در دریافت اشتراک‌ها.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRetry()}
          className="cursor-pointer"
        >
          <RotateCcw className="size-4" aria-hidden /> تلاش دوباره
        </Button>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/50 px-6 py-16 text-center">
        <span className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <PackageOpen className="size-6" aria-hidden />
        </span>
        <p className="font-serif text-xl leading-tight">هنوز باکسی فعال نیست</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          یک باکس سرداب فعال کنید تا منتخب فیزیکی دوره‌ای به‌طور منظم به دستتان
          برسد. توقف، رد دوره یا لغو همیشه در دسترس است.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {subscriptions.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          sub={subscription}
          address={
            subscription.address_id
              ? addressById.get(subscription.address_id)
              : undefined
          }
          addresses={addresses}
          busy={busyId === subscription.id}
          onRequestSkip={() => onRequestSkip(subscription.id)}
          onResume={() => onResume(subscription.id)}
          onRequestPause={() => onRequestPause(subscription.id)}
          onRequestCancel={() => onRequestCancel(subscription.id)}
          onChangeAddress={(addressId) =>
            onChangeAddress(subscription.id, addressId)
          }
        />
      ))}
    </ul>
  );
}
