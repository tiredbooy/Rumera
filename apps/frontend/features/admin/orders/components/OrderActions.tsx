"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { ORDER_STATUS_FA } from "@/features/orders/labels"
import type { OrderStatus } from "@/features/orders/types"
import { AdminOrderClientError } from "@/features/orders/api/admin-client"
import {
  useRefundAdminOrder,
  useUpdateAdminOrderStatus,
} from "@/features/admin/orders/hooks"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Warehouse graph from PR-020l. Money statuses are not PATCH targets. */
const FULFILLMENT_NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ["processing"],
  processing: ["ready_to_ship", "shipped"],
  ready_to_ship: ["shipped"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
}

const REFUNDABLE: ReadonlySet<OrderStatus> = new Set([
  "paid",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
])

function fulfillmentOptions(from: OrderStatus): OrderStatus[] {
  return FULFILLMENT_NEXT[from] ?? []
}

export function OrderActions({
  orderId,
  status,
  canWrite,
}: {
  orderId: number
  status: OrderStatus
  canWrite: boolean
}) {
  const router = useRouter()
  const [current, setCurrent] = React.useState<OrderStatus>(status)
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [deliverOpen, setDeliverOpen] = React.useState(false)
  const updateStatus = useUpdateAdminOrderStatus(orderId)
  const refund = useRefundAdminOrder(orderId)
  const nextStatuses = fulfillmentOptions(current)
  const canRefund = canWrite && REFUNDABLE.has(current)

  React.useEffect(() => {
    setCurrent(status)
  }, [status])

  async function changeStatus(next: OrderStatus) {
    if (!fulfillmentOptions(current).includes(next)) {
      toast.error("این انتقال وضعیت مجاز نیست")
      return
    }
    const previous = current
    setCurrent(next)
    try {
      await updateStatus.mutateAsync({ status: next })
      toast.success(`وضعیت سفارش به «${ORDER_STATUS_FA[next]}» تغییر کرد`)
      router.refresh()
    } catch (e) {
      setCurrent(previous)
      toast.error(e instanceof AdminOrderClientError ? e.message : "تغییر وضعیت ناموفق بود")
    }
  }

  async function confirmRefund() {
    try {
      await refund.mutateAsync()
      setCurrent("refunded")
      setRefundOpen(false)
      toast.success("بازپرداخت ثبت شد")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof AdminOrderClientError ? e.message : "بازپرداخت ناموفق بود")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> چاپ فاکتور
      </Button>

      {canWrite && nextStatuses.length > 0 ? (
        <Select
          value={current}
          disabled={updateStatus.isPending || refund.isPending}
          onValueChange={(v) => {
            const next = v as OrderStatus
            if (next === "delivered") {
              setDeliverOpen(true)
              return
            }
            void changeStatus(next)
          }}
        >
          <SelectTrigger size="sm" className="min-w-44" data-testid="order-fulfill-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={current} disabled>
              {ORDER_STATUS_FA[current]}
            </SelectItem>
            {nextStatuses.map((value) => (
              <SelectItem key={value} value={value}>
                {ORDER_STATUS_FA[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {canRefund ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          data-testid="order-refund-trigger"
          disabled={refund.isPending || updateStatus.isPending}
          onClick={() => setRefundOpen(true)}
        >
          بازپرداخت
        </Button>
      ) : null}

      <AlertDialog
        open={deliverOpen}
        onOpenChange={(open) => {
          if (!updateStatus.isPending) setDeliverOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ثبت تحویل؟</AlertDialogTitle>
            <AlertDialogDescription>
              سفارش به‌عنوان «{ORDER_STATUS_FA.delivered}» علامت می‌خورد. این
              معمولاً پایان مسیر انبار است و برگشت آن از همین انتخاب ممکن نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="order-deliver-confirm"
              disabled={updateStatus.isPending}
              onClick={(e) => {
                e.preventDefault()
                setDeliverOpen(false)
                void changeStatus("delivered")
              }}
            >
              تأیید تحویل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={refundOpen}
        onOpenChange={(open) => {
          if (!refund.isPending) setRefundOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ثبت بازپرداخت؟</AlertDialogTitle>
            <AlertDialogDescription>
              این عمل پول را برمی‌گرداند (کیف پول در صورت پرداخت از کیف پول)
              و موجودی را آزاد می‌کند. وضعیت را دستی «بازپرداخت‌شده» نکنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refund.isPending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              data-testid="order-refund-confirm"
              disabled={refund.isPending}
              onClick={(e) => {
                e.preventDefault()
                void confirmRefund()
              }}
            >
              تأیید بازپرداخت
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
