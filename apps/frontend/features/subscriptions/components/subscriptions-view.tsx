"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  useCreateSubscription,
  useSubscriptions,
  useUpdateSubscription,
} from "@/features/subscriptions/hooks";
import type {
  SubscriptionAction,
  SubscriptionCadence,
  SubscriptionStatus,
} from "@/features/subscriptions/types";
import { useAddresses } from "@/features/addresses/api";
import type { Address } from "@/features/addresses/types";
import { apiErrorToast } from "@/lib/api/user-facing-error";
import {
  SubscriptionActionDialog,
  type PendingSubscriptionAction,
} from "./subscription-action-dialog";
import { SubscriptionCreatePanel } from "./subscription-create-panel";
import { actionSuccessMessage } from "./subscription-display-helpers";
import { SubscriptionsPanel } from "./subscriptions-panel";

export function SubscriptionsView() {
  const { data, isLoading, isError, refetch } = useSubscriptions();
  const { data: addresses } = useAddresses();
  const create = useCreateSubscription();
  const update = useUpdateSubscription();

  const [cadence, setCadence] = React.useState<SubscriptionCadence>("monthly");
  const [addressId, setAddressId] = React.useState<number | null>(null);
  const [confirm, setConfirm] = React.useState<PendingSubscriptionAction>(null);
  /** Tracks which subscription row is mid-mutation so we only spin its buttons. */
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const addressList = addresses ?? [];

  const addressById = React.useMemo(() => {
    const map = new Map<number, Address>();
    for (const a of addressList) map.set(a.id, a);
    return map;
  }, [addressList]);

  // Prefer default address once list loads (if user has not chosen yet).
  React.useEffect(() => {
    if (addressId != null) return;
    const def = addressList.find((a) => a.is_default);
    if (def) setAddressId(def.id);
  }, [addressList, addressId]);

  function subscribe() {
    create.mutate(
      {
        cadence,
        address_id: addressId,
      },
      {
        onSuccess: () =>
          toast.success("باکس سرداب فعال شد", {
            description:
              "تاریخ ارسال بعدی روی کارت نمایش داده می‌شود. پرداخت خودکار انجام نشده است.",
          }),
        onError: (err) => {
          const t = apiErrorToast(err, "فعال‌سازی باکس ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
      },
    );
  }

  function run(id: number, action: SubscriptionAction) {
    setBusyId(id);
    update.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(actionSuccessMessage(action)),
        onError: (err) => {
          const t = apiErrorToast(err, "عملیات ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
        onSettled: () => setBusyId(null),
      },
    );
  }

  // Surface everything — including paused & cancelled history.
  const ordered = React.useMemo(() => {
    const rank: Record<SubscriptionStatus, number> = {
      active: 0,
      paused: 1,
      cancelled: 2,
    };
    const subs = data ?? [];
    return [...subs].sort((a, b) => rank[a.status] - rank[b.status]);
  }, [data]);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <SubscriptionCreatePanel
        cadence={cadence}
        addressId={addressId}
        addresses={addressList}
        isPending={create.isPending}
        onCadenceChange={setCadence}
        onAddressChange={setAddressId}
        onSubscribe={subscribe}
      />
      <SubscriptionsPanel
        subscriptions={ordered}
        addressById={addressById}
        busyId={busyId}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRequestSkip={(id) => setConfirm({ id, action: "skip" })}
        onResume={(id) => run(id, "resume")}
        onRequestPause={(id) => setConfirm({ id, action: "pause" })}
        onRequestCancel={(id) => setConfirm({ id, action: "cancel" })}
      />
      <SubscriptionActionDialog
        target={confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        onConfirm={({ id, action }) => {
          run(id, action);
          setConfirm(null);
        }}
      />
    </div>
  );
}
