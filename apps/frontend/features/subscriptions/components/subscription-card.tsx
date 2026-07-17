import {
  CalendarClock,
  CircleCheck,
  CirclePause,
  CircleSlash,
  Loader2,
  MapPin,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Address } from "@/features/addresses/types";
import type { Subscription } from "@/features/subscriptions/types";
import { cn } from "@/lib/utils";
import {
  cadenceLabel,
  faDate,
  formatAddress,
  planName,
} from "./subscription-display-helpers";

/** Plain-language status metadata, including a non-color-only icon. */
const statusMeta: Record<
  Subscription["status"],
  {
    label: string;
    icon: typeof CircleCheck;
    explain: string;
    banner: string;
    iconClass: string;
  }
> = {
  active: {
    label: "فعال",
    icon: CircleCheck,
    explain:
      "این اشتراک فعال است؛ باکس بعدی در تاریخ تمدید برایتان ارسال می‌شود.",
    banner: "bg-emerald-500/10 ring-emerald-500/25",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  paused: {
    label: "متوقف‌شده",
    icon: CirclePause,
    explain:
      "ارسال‌ها موقتاً متوقف شده‌اند. هیچ باکسی ارسال نمی‌شود تا زمانی که از سر بگیرید.",
    banner: "bg-amber-500/10 ring-amber-500/25",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  cancelled: {
    label: "لغوشده",
    icon: CircleSlash,
    explain:
      "این اشتراک لغو شده و دیگر باکسی ارسال نمی‌شود. می‌توانید آن را دوباره فعال کنید.",
    banner: "bg-muted ring-foreground/10",
    iconClass: "text-muted-foreground",
  },
};

type SubscriptionCardProps = {
  sub: Subscription;
  address?: Address;
  busy: boolean;
  onSkip: () => void;
  onResume: () => void;
  onRequestPause: () => void;
  onRequestCancel: () => void;
};

export function SubscriptionCard({
  sub,
  address,
  busy,
  onSkip,
  onResume,
  onRequestPause,
  onRequestCancel,
}: SubscriptionCardProps) {
  const meta = statusMeta[sub.status];
  const StatusIcon = meta.icon;
  const cancelled = sub.status === "cancelled";

  return (
    <li className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 shadow-e1">
      <div className="p-5 sm:p-6">
        {/* Header: plan + status pill */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl leading-tight">
              {planName(sub.plan)}
            </h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden />
              {cadenceLabel(sub.cadence)}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
              meta.banner,
            )}
          >
            <StatusIcon
              className={cn("size-3.5", meta.iconClass)}
              aria-hidden
            />
            {meta.label}
          </span>
        </div>

        {/* Plain-language status banner */}
        <div
          className={cn(
            "mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 ring-1 ring-inset",
            meta.banner,
          )}
        >
          <StatusIcon
            className={cn("mt-0.5 size-4 shrink-0", meta.iconClass)}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-foreground/80">
            {meta.explain}
          </p>
        </div>

        {/* Facts: next renewal + ship-to */}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-hairline rounded-xl bg-background/40 px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> تمدید بعدی
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm font-medium",
                cancelled && "text-muted-foreground line-through",
              )}
            >
              {faDate(sub.next_renewal_at)}
            </dd>
          </div>
          {address ? (
            <div className="border-hairline rounded-xl bg-background/40 px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> ارسال به
              </dt>
              <dd
                className="mt-1 truncate text-sm font-medium"
                title={formatAddress(address)}
              >
                {address.title || address.full_name}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — {formatAddress(address)}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {sub.status === "active" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSkip}
                disabled={busy}
                className="cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <SkipForward className="size-4" aria-hidden />
                )}
                رد کردن این دوره
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestPause}
                disabled={busy}
                className="cursor-pointer"
              >
                <Pause className="size-4" aria-hidden /> توقف موقت
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRequestCancel}
                disabled={busy}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <X className="size-4" aria-hidden /> لغو اشتراک
              </Button>
            </>
          ) : sub.status === "paused" ? (
            <>
              <Button
                size="sm"
                onClick={onResume}
                disabled={busy}
                className="cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
                از سر گرفتن
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRequestCancel}
                disabled={busy}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <X className="size-4" aria-hidden /> لغو اشتراک
              </Button>
            </>
          ) : (
            // cancelled → reactivate (the `resume` action restores it to active)
            <Button
              size="sm"
              onClick={onResume}
              disabled={busy}
              className="cursor-pointer"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-4" aria-hidden />
              )}
              فعال‌سازی مجدد
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
