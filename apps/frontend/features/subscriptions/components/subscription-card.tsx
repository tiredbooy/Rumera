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
  canChangeShipTo,
  faDate,
  formatAddress,
  missingShipToMessage,
  nextShipHint,
  nextShipTitle,
  planName,
  statusCopy,
} from "./subscription-display-helpers";

const statusChrome: Record<
  Subscription["status"],
  {
    icon: typeof CircleCheck;
    banner: string;
    iconClass: string;
  }
> = {
  active: {
    icon: CircleCheck,
    banner: "bg-success/12 ring-success/25",
    iconClass: "text-success",
  },
  paused: {
    icon: CirclePause,
    banner: "bg-warning/12 ring-warning/25",
    iconClass: "text-warning",
  },
  cancelled: {
    icon: CircleSlash,
    banner: "bg-muted ring-foreground/10",
    iconClass: "text-muted-foreground",
  },
};

type SubscriptionCardProps = {
  sub: Subscription;
  address?: Address;
  addresses: Address[];
  busy: boolean;
  onRequestSkip: () => void;
  onResume: () => void;
  onRequestPause: () => void;
  onRequestCancel: () => void;
  onChangeAddress: (addressId: number) => void;
};

export function SubscriptionCard({
  sub,
  address,
  addresses,
  busy,
  onRequestSkip,
  onResume,
  onRequestPause,
  onRequestCancel,
  onChangeAddress,
}: SubscriptionCardProps) {
  const chrome = statusChrome[sub.status];
  const copy = statusCopy(sub.status);
  const StatusIcon = chrome.icon;
  const cancelled = sub.status === "cancelled";
  const paused = sub.status === "paused";
  const editable = canChangeShipTo(sub.status);
  const missingAddress = !address;
  const pickerLabel = address ? "تغییر آدرس ارسال" : "انتخاب آدرس ارسال";
  const selectId = `sub-ship-address-${sub.id}`;
  const currentIdMissingFromBook =
    sub.address_id != null &&
    !addresses.some((item) => item.id === sub.address_id);

  return (
    <li className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 shadow-e1">
      <div className="p-5 sm:p-6">
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
              chrome.banner,
            )}
          >
            <StatusIcon
              className={cn("size-3.5", chrome.iconClass)}
              aria-hidden
            />
            {copy.label}
          </span>
        </div>

        <div
          className={cn(
            "mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 ring-1 ring-inset",
            chrome.banner,
          )}
        >
          <StatusIcon
            className={cn("mt-0.5 size-4 shrink-0", chrome.iconClass)}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-foreground/80">
            {copy.explain}
          </p>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-hairline rounded-xl bg-background/40 px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden />{" "}
              {nextShipTitle(sub.status)}
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm font-medium",
                cancelled && "text-muted-foreground line-through",
                paused && "text-muted-foreground",
              )}
            >
              {faDate(sub.next_renewal_at)}
            </dd>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {nextShipHint(sub.status)}
            </p>
          </div>
          <div
            className={cn(
              "border-hairline rounded-xl px-3.5 py-3",
              missingAddress
                ? "bg-warning/10 ring-1 ring-inset ring-warning/25"
                : "bg-background/40",
            )}
          >
            <dt
              className={cn(
                "flex items-center gap-1.5 text-xs",
                missingAddress
                  ? "text-warning"
                  : "text-muted-foreground",
              )}
            >
              <MapPin className="size-3.5" aria-hidden />{" "}
              {address ? "ارسال به" : "آدرس ارسال"}
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm leading-relaxed",
                address ? "truncate font-medium" : "text-muted-foreground",
              )}
              title={address ? formatAddress(address) : undefined}
            >
              {address ? (
                <>
                  {address.title || address.full_name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    — {formatAddress(address)}
                  </span>
                </>
              ) : editable ? (
                missingShipToMessage(addresses.length > 0)
              ) : (
                "آدرسی ثبت نشده است."
              )}
            </dd>
            {editable && addresses.length > 0 ? (
              <div className="mt-2">
                <label
                  className="mb-1 block text-xs text-muted-foreground"
                  htmlFor={selectId}
                >
                  {pickerLabel}
                </label>
                <select
                  id={selectId}
                  value={sub.address_id ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next) || next < 1) return;
                    if (next === sub.address_id) return;
                    onChangeAddress(next);
                  }}
                  className="border-hairline h-10 w-full cursor-pointer rounded-xl bg-background px-3 text-sm ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sub.address_id == null && (
                    <option value="">انتخاب آدرس ارسال</option>
                  )}
                  {currentIdMissingFromBook && sub.address_id != null && (
                    <option value={sub.address_id}>
                      آدرس فعلی (دیگر در دفترچه نیست)
                    </option>
                  )}
                  {addresses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.title || item.full_name) +
                        " — " +
                        formatAddress(item)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {sub.status === "active" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestSkip}
                disabled={busy}
                className="cursor-pointer"
                title="تاریخ ارسال باکس بعدی یک دوره جلو می‌رود"
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
                title="ارسال موقتاً متوقف می‌شود"
              >
                <Pause className="size-4" aria-hidden /> توقف موقت
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRequestCancel}
                disabled={busy}
                className="cursor-pointer text-destructive hover:text-destructive"
                title="لغو کامل اشتراک باکس"
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
