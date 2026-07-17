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
import {
  SubscriptionActionDialog,
  type PendingSubscriptionAction,
} from "./subscription-action-dialog";
import { SubscriptionCreatePanel } from "./subscription-create-panel";
import { SubscriptionsPanel } from "./subscriptions-panel";

export function SubscriptionsView() {
  const { data, isLoading, isError, refetch } = useSubscriptions();
  const { data: addresses } = useAddresses();
  const create = useCreateSubscription();
  const update = useUpdateSubscription();

  const [cadence, setCadence] = React.useState<SubscriptionCadence>("monthly");
  const [confirm, setConfirm] = React.useState<PendingSubscriptionAction>(null);
  /** Tracks which subscription row is mid-mutation so we only spin its buttons. */
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const addressById = React.useMemo(() => {
    const map = new Map<number, Address>();
    for (const a of addresses ?? []) map.set(a.id, a);
    return map;
  }, [addresses]);

  function subscribe() {
    create.mutate(
      { cadence },
      {
        onSuccess: () => toast.success("اشتراک شما فعال شد"),
        onError: () => toast.error("ایجاد اشتراک ناموفق بود"),
      },
    );
  }

  function run(id: number, action: SubscriptionAction) {
    setBusyId(id);
    update.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(
            action === "cancel"
              ? "اشتراک لغو شد"
              : action === "skip"
                ? "ارسال این دوره به دورهٔ بعد موکول شد"
                : action === "pause"
                  ? "اشتراک متوقف شد"
                  : "اشتراک دوباره فعال شد",
          ),
        onError: () => toast.error("عملیات ناموفق بود"),
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
    <div className="flex flex-col gap-6">
      <SubscriptionCreatePanel
        cadence={cadence}
        isPending={create.isPending}
        onCadenceChange={setCadence}
        onSubscribe={subscribe}
      />
      <SubscriptionsPanel
        subscriptions={ordered}
        addressById={addressById}
        busyId={busyId}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onSkip={(id) => run(id, "skip")}
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
