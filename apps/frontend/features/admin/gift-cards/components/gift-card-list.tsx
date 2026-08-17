"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Gift,
  Loader2,
  RotateCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListPagination } from "@/components/list-pagination";
import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GiftCardApiError } from "@/features/gift-cards/api/admin-client";
import {
  useAdminGiftCards,
  useVoidGiftCard,
} from "@/features/gift-cards/hooks";
import type {
  AdminGiftCardListQuery,
  AdminGiftCardRow,
  GiftCardStatus,
} from "@/features/gift-cards/types";
import { formatPaymentAmount } from "@/features/payments/presentation";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import {
  GIFT_CARD_STATUS_FA,
  GiftCardStatusBadge,
} from "./gift-card-status-badge";

const PAGE_SIZE = 20;
const STATUS_VALUES = ["active", "redeemed", "disabled"] as const;

export type GiftCardSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export function positivePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function giftCardStatus(
  value: string | null,
): GiftCardStatus | undefined {
  return value === "active" || value === "redeemed" || value === "disabled"
    ? value
    : undefined;
}

export function giftCardSort(value: string | null): GiftCardSort {
  return value === "oldest" ||
    value === "amount_desc" ||
    value === "amount_asc"
    ? value
    : "newest";
}

function sortQuery(
  sort: GiftCardSort,
): Pick<AdminGiftCardListQuery, "sortBy" | "orderBy"> {
  if (sort === "oldest") return { sortBy: "created_at", orderBy: "asc" };
  if (sort === "amount_desc")
    return { sortBy: "initial_amount", orderBy: "desc" };
  if (sort === "amount_asc")
    return { sortBy: "initial_amount", orderBy: "asc" };
  return { sortBy: "created_at", orderBy: "desc" };
}

function voidErrorMessage(error: unknown): string {
  return error instanceof GiftCardApiError
    ? error.message
    : "ابطال کارت ناموفق بود";
}

function GiftCardLoading() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری کارت‌های هدیه"
      className="space-y-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="border-hairline flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="ms-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function GiftCardSource({ card }: { card: AdminGiftCardRow }) {
  if (card.purchase_txid) {
    return (
      <div className="min-w-0">
        <p>خرید مشتری</p>
        {card.purchaser_user_id ? (
          <p className="text-xs text-muted-foreground">
            کاربر #{faNum(card.purchaser_user_id)}
          </p>
        ) : null}
        <p
          className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
          dir="ltr"
          title={card.purchase_txid}
        >
          {card.purchase_txid}
        </p>
      </div>
    );
  }

  return <span className="text-muted-foreground">صدور اپراتور</span>;
}

function GiftCardMobileCard({
  card,
  voiding,
  onVoid,
}: {
  card: AdminGiftCardRow;
  voiding: boolean;
  onVoid: () => void;
}) {
  return (
    <article className="border-hairline min-w-0 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <code
          className="min-w-0 break-all font-mono text-sm font-semibold"
          dir="ltr"
        >
          {card.code}
        </code>
        <GiftCardStatusBadge status={card.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">مبلغ</dt>
          <dd className="mt-1 font-medium">
            {formatPaymentAmount(card.initial_amount, "IRT")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">منبع</dt>
          <dd className="mt-1">
            <GiftCardSource card={card} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">ثبت</dt>
          <dd className="mt-1" dir="ltr">
            {faDateTime(card.created_at)}
          </dd>
        </div>
        {card.redeemed_at ? (
          <div>
            <dt className="text-xs text-muted-foreground">استفاده</dt>
            <dd className="mt-1" dir="ltr">
              {faDateTime(card.redeemed_at)}
              {card.redeemed_by ? (
                <span className="ms-1 text-muted-foreground">
                  · #{faNum(card.redeemed_by)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      {card.status === "active" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          disabled={voiding}
          onClick={onVoid}
        >
          <Ban className="size-4" aria-hidden />
          باطل کردن
        </Button>
      ) : null}
    </article>
  );
}

export function GiftCardList() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = positivePage(searchParams.get("page"));
  const status = giftCardStatus(searchParams.get("status"));
  const sort = giftCardSort(searchParams.get("sort"));
  const query = searchParams.get("q")?.trim() ?? "";
  const [search, setSearch] = React.useState(query);
  const [lastQuery, setLastQuery] = React.useState(query);
  const [voidTarget, setVoidTarget] = React.useState<AdminGiftCardRow | null>(
    null,
  );
  const [voidError, setVoidError] = React.useState<string | null>(null);

  if (query !== lastQuery) {
    setLastQuery(query);
    setSearch(query);
  }

  const updateURL = React.useCallback(
    (
      updates: Record<string, string | undefined>,
      resetPage = false,
      replace = false,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.delete("page");
      const suffix = params.toString();
      const href = suffix ? `${pathname}?${suffix}` : pathname;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (search.trim() === query) return;
    const timer = window.setTimeout(
      () =>
        updateURL({ q: search.trim() || undefined }, true),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [query, search, updateURL]);

  const listQuery: AdminGiftCardListQuery = {
    page,
    limit: PAGE_SIZE,
    status,
    search: query || undefined,
    ...sortQuery(sort),
  };
  const cards = useAdminGiftCards(listQuery);
  const voidCard = useVoidGiftCard();
  const outOfRangePage = Boolean(
    cards.data &&
      cards.data.results.length === 0 &&
      cards.data.pagination.total_items > 0 &&
      page > cards.data.pagination.total_pages,
  );
  const hasFilters = Boolean(status || query || sort !== "newest");
  const listError =
    cards.error instanceof GiftCardApiError
      ? cards.error.message
      : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";

  React.useEffect(() => {
    if (!outOfRangePage || !cards.data) return;
    const lastPage = cards.data.pagination.total_pages;
    updateURL(
      { page: lastPage > 1 ? String(lastPage) : undefined },
      false,
      true,
    );
  }, [outOfRangePage, cards.data, updateURL]);

  async function confirmVoid() {
    if (!voidTarget) return;
    setVoidError(null);
    try {
      await voidCard.mutateAsync(voidTarget.id);
      toast.success("کارت هدیه باطل شد");
      setVoidTarget(null);
    } catch (error) {
      const message = voidErrorMessage(error);
      setVoidError(message);
      toast.error(message);
      void cards.refetch();
    }
  }

  return (
    <section aria-label="دفتر کارت‌ها">
      <AdminFilterBar
        id="gift-card-filter-title"
        title="جستجو و فیلتر کارت‌ها"
        hasFilters={hasFilters}
        onReset={() => router.push(pathname)}
        gridClassName="lg:grid-cols-[minmax(0,1fr)_12rem_12rem]"
      >
        <div className="relative min-w-0">
          <Label htmlFor="gift-card-search" className="sr-only">
            جستجو در کد کارت
          </Label>
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="gift-card-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در کد کارت…"
            className="h-11 ps-9"
            disabled={voidCard.isPending}
          />
        </div>

        <Select
          value={status ?? "all"}
          onValueChange={(value) =>
            updateURL(
              { status: value === "all" ? undefined : value },
              true,
            )
          }
        >
          <SelectTrigger className="h-11 w-full" aria-label="فیلتر وضعیت کارت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
            {STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {GIFT_CARD_STATUS_FA[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) =>
            updateURL({ sort: value === "newest" ? undefined : value }, true)
          }
        >
          <SelectTrigger className="h-11 w-full" aria-label="ترتیب کارت‌ها">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">جدیدترین</SelectItem>
            <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
            <SelectItem value="amount_desc">بیشترین مبلغ</SelectItem>
            <SelectItem value="amount_asc">کمترین مبلغ</SelectItem>
          </SelectContent>
        </Select>
      </AdminFilterBar>

      {cards.isLoading ? <GiftCardLoading /> : null}

      {cards.isError && !cards.data ? (
        <div
          role="alert"
          className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-5 text-center ring-1 ring-foreground/[0.04]"
        >
          <p className="font-medium">بارگذاری کارت‌های هدیه ناموفق بود.</p>
          <p className="max-w-sm text-sm text-muted-foreground">{listError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cards.isFetching}
            onClick={() => void cards.refetch()}
          >
            {cards.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="size-4" aria-hidden />
            )}
            {cards.isFetching ? "در حال تلاش…" : "تلاش دوباره"}
          </Button>
        </div>
      ) : null}

      {cards.isError && cards.data ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm"
        >
          <div>
            <p>
              به‌روزرسانی ناموفق بود؛ دادهٔ نمایش‌داده‌شده ممکن است قدیمی باشد.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{listError}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void cards.refetch()}
          >
            <RotateCw className="size-4" aria-hidden /> تلاش دوباره
          </Button>
        </div>
      ) : null}

      {cards.data && cards.data.results.length === 0 ? (
        <div className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-5 text-center ring-1 ring-foreground/[0.04]">
          <Gift className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRangePage
              ? "در حال بازگشت به آخرین صفحه…"
              : hasFilters
                ? "کارتی با این فیلترها پیدا نشد."
                : "هنوز کارتی صادر نشده است."}
          </p>
        </div>
      ) : null}

      {cards.data && cards.data.results.length > 0 ? (
        <div aria-busy={cards.isFetching || voidCard.isPending || undefined}>
          <div className="grid gap-3 lg:hidden">
            {cards.data.results.map((card) => (
              <GiftCardMobileCard
                key={card.id}
                card={card}
                voiding={voidCard.isPending && voidCard.variables === card.id}
                onVoid={() => {
                  setVoidError(null);
                  setVoidTarget(card);
                }}
              />
            ))}
          </div>
          <div className="border-hairline hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] lg:block">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[28%] text-start">کد</TableHead>
                  <TableHead className="w-[16%] text-start">مبلغ</TableHead>
                  <TableHead className="w-[12%] text-start">وضعیت</TableHead>
                  <TableHead className="w-[20%] text-start">منبع</TableHead>
                  <TableHead className="w-[14%] text-start">ثبت</TableHead>
                  <TableHead className="w-[10%] text-start">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.data.results.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="max-w-56">
                      <code
                        className="block truncate font-mono text-xs font-semibold"
                        dir="ltr"
                        title={card.code}
                      >
                        {card.code}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPaymentAmount(card.initial_amount, "IRT")}
                    </TableCell>
                    <TableCell>
                      <GiftCardStatusBadge status={card.status} />
                    </TableCell>
                    <TableCell>
                      <GiftCardSource card={card} />
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {faDateTime(card.created_at)}
                    </TableCell>
                    <TableCell>
                      {card.status === "active" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={voidCard.isPending}
                          aria-label={`باطل کردن ${card.code}`}
                          onClick={() => {
                            setVoidError(null);
                            setVoidTarget(card);
                          }}
                        >
                          <Ban className="size-4" aria-hidden />
                          باطل
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {cards.data && cards.data.pagination.total_items > 0 ? (
        <ListPagination
          page={cards.data.pagination.page}
          totalPages={cards.data.pagination.total_pages}
          hasPrev={cards.data.pagination.has_prev}
          hasNext={cards.data.pagination.has_next}
          onPrev={() =>
            updateURL({ page: page > 2 ? String(page - 1) : undefined })
          }
          onNext={() => updateURL({ page: String(page + 1) })}
          disabled={cards.isFetching}
          ariaLabel="صفحه‌بندی کارت‌های هدیه"
          className="mt-6"
          label={
            <>
              {faNum(cards.data.pagination.total_items)} کارت · صفحهٔ{" "}
              {faNum(cards.data.pagination.page)} از{" "}
              {faNum(cards.data.pagination.total_pages)}
            </>
          }
        />
      ) : null}

      <AlertDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open && !voidCard.isPending) {
            setVoidTarget(null);
            setVoidError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>باطل کردن کارت هدیه</AlertDialogTitle>
            <AlertDialogDescription>
              کارت «{voidTarget?.code}» غیرفعال می‌شود و دیگر قابل استفاده
              نیست. این کار بازپرداخت نیست و موجودی کیف پول را تغییر نمی‌دهد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {voidError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {voidError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidCard.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={voidCard.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmVoid();
              }}
            >
              {voidCard.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              بله، باطل شود
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
