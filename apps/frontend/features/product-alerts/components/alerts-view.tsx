"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, Loader2, Trash2 } from "lucide-react";

import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import { AccountSection } from "@/features/account/account/components/account-section";
import { EmptyState } from "@/features/account/EmptyState";

import {
  ALERT_TYPE_LABELS,
  productAlertHeading,
  productAlertHref,
} from "../alert-display";
import { useDeleteProductAlert, useProductAlerts } from "../hooks";
import type { ProductAlert } from "../types";

export function AlertsView() {
  const alerts = useProductAlerts();
  const del = useDeleteProductAlert();
  const [toDelete, setToDelete] = React.useState<ProductAlert | null>(null);

  const items = alerts.data ?? [];

  function confirmDelete() {
    if (!toDelete) return;
    del.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success("اعلان حذف شد");
        setToDelete(null);
      },
      onError: () => toast.error("حذف اعلان ناموفق بود"),
    });
  }

  if (alerts.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (alerts.isError) {
    return (
      <DashboardErrorState
        title="خطا در دریافت اعلان‌ها"
        description="فهرست اعلان‌ها بارگذاری نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
        onRetry={() => void alerts.refetch()}
        isRetrying={alerts.isFetching}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="هنوز اعلانی ثبت نکرده‌اید"
        description="از صفحه محصول می‌توانید برای موجود شدن دوباره یا کاهش قیمت خبر بگیرید."
        actionLabel="کشف محصولات"
        actionHref="/products"
      />
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{faNum(items.length)}</span>{" "}
        اعلان ثبت‌شده
      </p>

      <div className="space-y-4">
        {items.map((alert) => {
          const heading = productAlertHeading(alert);
          const href = productAlertHref(alert);
          const notified = Boolean(alert.notified_at);
          return (
            <AccountSection key={alert.id} bodyClassName="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {href ? (
                    <Link
                      href={href}
                      className="truncate font-medium hover:text-primary"
                    >
                      {heading}
                    </Link>
                  ) : (
                    <p className="truncate font-medium">{heading}</p>
                  )}
                  <Badge variant="secondary">
                    {ALERT_TYPE_LABELS[alert.alert_type]}
                  </Badge>
                  <Badge variant={notified ? "default" : "outline"}>
                    {notified ? "ارسال‌شده" : "در انتظار"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ثبت {faDate(alert.created_at)}
                  {alert.target_price != null
                    ? ` · هدف ${formatPrice(alert.target_price)}`
                    : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-start text-muted-foreground hover:text-destructive sm:self-center"
                aria-label={`حذف اعلان ${heading}`}
                onClick={() => setToDelete(alert)}
                disabled={del.isPending}
              >
                <Trash2 className="size-4" /> حذف
              </Button>
            </AccountSection>
          );
        })}
      </div>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open && !del.isPending) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف اعلان</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `اعلان «${productAlertHeading(toDelete)}» دیگر ارسال نمی‌شود. می‌توانید دوباره از صفحه محصول ثبت کنید.`
                : "این اعلان دیگر ارسال نمی‌شود."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {del.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
