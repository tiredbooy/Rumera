import "server-only";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Award, Gem, History } from "lucide-react";

import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { loyaltyReasonLabel } from "@/features/loyalty/reasons";
import { ApiError } from "@/lib/api/errors";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { getLoyaltyMember, listLoyaltyMemberTransactions } from "../api/server";
import { canAdjustLoyalty, isLoyaltyEnabled } from "../guard";
import { loyaltyTierLabel, signedPoints } from "../labels";
import type { LoyaltyMemberAccount, LoyaltyMemberTransaction } from "../types";
import { LoyaltyAdjustForm } from "./loyalty-adjust-form";

/** A trail, not a ledger — the full one is one click away on the member page. */
const ACTIVITY_ROWS = 5;

/**
 * The loyalty module's embeddable standing widget (L-5).
 *
 * Self-contained on purpose: a host screen imports this one component and
 * passes a user UUID. Everything else — the programme kill switch (L-2), the
 * `loyalty:adjust` mint gate (L-8), the account read and the recent ledger —
 * is resolved in here, so no embedding screen has to reimplement the module's
 * rules. The async work sits behind its own Suspense boundary so the host
 * streams instead of blocking on loyalty.
 */
export function CustomerLoyaltyPanel({ userID }: { userID: string }) {
  return (
    <Suspense fallback={<CustomerLoyaltyPanelSkeleton />}>
      <CustomerLoyaltyStanding userID={userID} />
    </Suspense>
  );
}

type Standing =
  /** `activity: null` is a failed ledger read — `[]` is a member who never moved. */
  | {
      state: "ok";
      member: LoyaltyMemberAccount;
      activity: LoyaltyMemberTransaction[] | null;
    }
  /** No loyalty account to show, or this operator may not read one. */
  | { state: "absent" }
  | { state: "unavailable" };

async function loadStanding(userID: string): Promise<Standing> {
  let member: LoyaltyMemberAccount;
  try {
    member = await getLoyaltyMember(userID);
  } catch (error) {
    if (error instanceof ApiError) {
      // An embed must never take its host down: a customer the loyalty module
      // does not know, or a viewer it will not answer, means "no panel here".
      if ([400, 401, 403, 404, 422].includes(error.status)) {
        return { state: "absent" };
      }
    }
    return { state: "unavailable" };
  }

  try {
    const page = await listLoyaltyMemberTransactions(userID, {
      page: 1,
      limit: ACTIVITY_ROWS,
    });
    return { state: "ok", member, activity: page.results };
  } catch {
    // Standing still renders; only the trail is missing.
    return { state: "ok", member, activity: null };
  }
}

/** The streamed half of the widget: everything that has to await a read. */
export async function CustomerLoyaltyStanding({ userID }: { userID: string }) {
  const [enabled, canAdjust, standing] = await Promise.all([
    isLoyaltyEnabled(),
    canAdjustLoyalty(),
    loadStanding(userID),
  ]);

  // Switched off: the widget disappears rather than offering a dead surface.
  if (!enabled || standing.state === "absent") return null;

  if (standing.state === "unavailable") {
    return (
      <PanelShell userID={userID}>
        <AdminDataErrorState
          title="دریافت وضعیت باشگاه ناموفق بود"
          description="موجودی امتیاز و سطح از سرور دریافت نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
          className="px-4 py-8"
        />
      </PanelShell>
    );
  }

  const { member, activity } = standing;

  return (
    <>
      <PanelShell userID={userID}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">موجودی امتیاز</dt>
            <dd
              className="mt-1 font-serif text-2xl tabular-nums text-foil"
              dir="ltr"
              data-testid="customer-loyalty-balance"
            >
              {faNum(member.points_balance)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">امتیاز lifetime</dt>
            <dd className="mt-1 font-medium tabular-nums" dir="ltr">
              {faNum(member.lifetime_points)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">سطح</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-medium">
              <Gem className="size-3.5 text-primary" aria-hidden />
              {loyaltyTierLabel(member.tier)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">سطح بعدی</dt>
            <dd className="mt-1 font-medium">
              {member.next_tier ? (
                <>
                  {loyaltyTierLabel(member.next_tier)}
                  <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                    {faNum(member.points_to_next)} امتیاز مانده
                  </span>
                </>
              ) : (
                "بالاترین سطح"
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-border/50 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <History className="size-3.5" aria-hidden />
            آخرین تغییرات امتیاز
          </p>
          {activity === null ? (
            <AdminDataErrorState
              title="دریافت دفتر کل ناموفق بود"
              description="موجودی بالا خوانده شده است، اما آخرین ردیف‌های دفتر کل نمایش داده نشد."
              className="px-4 py-6"
            />
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هنوز امتیازی برای این کاربر ثبت نشده است.
            </p>
          ) : (
            <ol className="grid gap-2">
              {activity.map((tx) => (
                <li key={tx.id}>
                  <ActivityRow tx={tx} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </PanelShell>

      {canAdjust ? (
        <div className="mt-4">
          <LoyaltyAdjustForm
            userId={member.user_id}
            userLabel={
              member.display_name?.trim() || member.email || member.user_id
            }
            canAdjust
          />
        </div>
      ) : null}
    </>
  );
}

function PanelShell({
  userID,
  children,
}: {
  userID: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6" aria-labelledby="customer-loyalty-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2
          id="customer-loyalty-title"
          className="flex items-center gap-2 font-serif text-lg"
        >
          <Award className="size-4.5 text-primary" aria-hidden />
          باشگاه مشتریان
        </h2>
        <Link
          href={`/admin/loyalty/${userID}`}
          className="text-xs text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          دفتر کل کامل
        </Link>
      </div>
      <div
        className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        data-testid="customer-loyalty-panel"
      >
        {children}
      </div>
    </section>
  );
}

function ActivityRow({ tx }: { tx: LoyaltyMemberTransaction }) {
  return (
    <article className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/30 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{loyaltyReasonLabel(tx.reason)}</p>
        {tx.note ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <bdi dir="auto">{tx.note}</bdi>
          </p>
        ) : null}
        {tx.actor_label ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            ثبت‌کننده: <bdi dir="auto">{tx.actor_label}</bdi>
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-end">
        {/* Sign, not colour: «+» / «−» reads the same in a screen reader. */}
        <p
          className={
            tx.delta < 0
              ? "font-medium tabular-nums text-destructive"
              : "font-medium tabular-nums"
          }
          dir="ltr"
        >
          {signedPoints(tx.delta)}
        </p>
        <time
          dateTime={tx.created_at}
          className="text-xs text-muted-foreground tabular-nums"
        >
          {faDateTime(tx.created_at)}
        </time>
      </div>
    </article>
  );
}

function CustomerLoyaltyPanelSkeleton() {
  return (
    <section className="mt-6" aria-hidden>
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-border/50 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}
