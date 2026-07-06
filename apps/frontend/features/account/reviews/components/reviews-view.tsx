"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Star,
  Loader2,
  Trash2,
  MessageSquare,
  MessageSquarePlus,
  PencilLine,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { faDate } from "@/lib/catalog/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { SmartImage } from "@/components/smart-image";
import {
  useMyReviews,
  usePendingReviews,
  useDeleteReview,
  type MyReview,
  type PendingReviewItem,
} from "@/lib/api/account-hooks";
import { AccountSection } from "../../account/components/account-section";
import { EmptyState } from "../../EmptyState";

const REVIEW_STATUS_FA: Record<
  string,
  { label: string; variant: "secondary" | "default" | "destructive" }
> = {
  pending: { label: "در انتظار تأیید", variant: "secondary" },
  approved: { label: "منتشر‌شده", variant: "default" },
  rejected: { label: "رد‌شده", variant: "destructive" },
};

function Stars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${faNum(value)} از ۵`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i < value
              ? "fill-primary text-primary"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

function productHref(slug: string | undefined, id: number) {
  return slug ? `/products/${slug}` : `/products?highlight=${id}`;
}

export function ReviewsView() {
  const [tab, setTab] = React.useState("written");
  const mine = useMyReviews();
  const pending = usePendingReviews();
  const del = useDeleteReview();
  const [toDelete, setToDelete] = React.useState<MyReview | null>(null);

  const myList = mine.data ?? [];
  const pendingList = pending.data ?? [];

  return (
    <>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="written" className="cursor-pointer">
            نوشته‌شده {myList.length > 0 ? `(${faNum(myList.length)})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pending" className="cursor-pointer">
            در انتظار نظر{" "}
            {pendingList.length > 0 ? `(${faNum(pendingList.length)})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* My reviews */}
        <TabsContent value="written">
          {mine.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : mine.isError ? (
            <ErrorBox onRetry={() => mine.refetch()} />
          ) : myList.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="هنوز دیدگاهی ثبت نکرده‌اید"
              description="پس از خرید و دریافت محصول، می‌توانید تجربهٔ خود را با دیگران به اشتراک بگذارید."
              actionLabel="مشاهدهٔ محصولات"
              actionHref="/products"
            />
          ) : (
            <div className="space-y-4">
              {myList.map((r: MyReview) => {
                const status = REVIEW_STATUS_FA[r.status] ?? {
                  label: r.status,
                  variant: "secondary" as const,
                };
                return (
                  <AccountSection key={r.id} bodyClassName="flex gap-4">
                    <Link
                      href={productHref(r.product_slug, r.product_id)}
                      className="relative size-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-foreground/5"
                      aria-label={r.product_title}
                    >
                      <SmartImage
                        src={r.image_url}
                        alt={r.product_title}
                        sizes="64px"
                        monogram={r.product_title.charAt(0)}
                        fallbackClassName="from-accent/40 via-card to-secondary"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={productHref(r.product_slug, r.product_id)}
                          className="truncate font-medium hover:text-primary"
                        >
                          {r.product_title}
                        </Link>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={r.rating} />
                        <span className="text-xs text-muted-foreground">
                          {faDate(r.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {r.body}
                      </p>
                      <div className="mt-3 flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={productHref(r.product_slug, r.product_id)}
                          >
                            <PencilLine className="size-4" /> ویرایش
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(r)}
                        >
                          <Trash2 className="size-4" /> حذف
                        </Button>
                      </div>
                    </div>
                  </AccountSection>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Pending reviews */}
        <TabsContent value="pending">
          {pending.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : pending.isError ? (
            <ErrorBox onRetry={() => pending.refetch()} />
          ) : pendingList.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title="محصولی در انتظار نظر نیست"
              description="پس از تحویل سفارش‌ها، محصولات قابل بازبینی اینجا نمایش داده می‌شوند."
            />
          ) : (
            <div className="space-y-4">
              {pendingList.map((p: PendingReviewItem) => (
                <AccountSection
                  key={`${p.order_id}-${p.product_id}`}
                  bodyClassName="flex items-center gap-4"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-foreground/5">
                    <SmartImage
                      src={p.image_url}
                      alt={p.product_title}
                      sizes="56px"
                      monogram={p.product_title.charAt(0)}
                      fallbackClassName="from-accent/40 via-card to-secondary"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.product_title}</p>
                    <p className="text-xs text-muted-foreground">
                      سفارش #{faNum(p.order_id)}
                      {p.delivered_at
                        ? ` · تحویل ${faDate(p.delivered_at)}`
                        : ""}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={productHref(p.product_slug, p.product_id)}>
                      <MessageSquarePlus className="size-4" /> نوشتن دیدگاه
                    </Link>
                  </Button>
                </AccountSection>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => (o ? null : setToDelete(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دیدگاه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این دیدگاه مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!toDelete) return;
                del.mutate(toDelete.id, {
                  onSuccess: () => toast.success("دیدگاه حذف شد"),
                  onError: () => toast.error("حذف ناموفق بود"),
                });
                setToDelete(null);
              }}
            >
              {del.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/40 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <MessageSquare className="size-6" />
      </span>
      <p className="text-sm text-muted-foreground">خطا در دریافت دیدگاه‌ها.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        تلاش دوباره
      </Button>
    </div>
  );
}
