"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, Printer } from "lucide-react"
import { toast } from "sonner"

import { ORDER_STATUS_FA } from "@/lib/catalog/labels"
import type { OrderStatus } from "@/lib/catalog/types"
import { updateOrderStatus, AdminApiError } from "@/lib/api/admin-client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const STATUS_OPTIONS = (Object.keys(ORDER_STATUS_FA) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_FA[value],
}))

export function OrderActions({
  orderId,
  status,
  canWrite,
  canRefund,
}: {
  orderId: number
  status: OrderStatus
  canWrite: boolean
  canRefund: boolean
}) {
  const router = useRouter()
  const [current, setCurrent] = React.useState<OrderStatus>(status)
  const [pending, setPending] = React.useState(false)

  async function changeStatus(next: OrderStatus) {
    const previous = current
    setCurrent(next) // optimistic
    setPending(true)
    try {
      await updateOrderStatus(orderId, next)
      toast.success(`وضعیت سفارش به «${ORDER_STATUS_FA[next]}» تغییر کرد`)
      router.refresh()
    } catch (e) {
      setCurrent(previous) // roll back
      toast.error(e instanceof AdminApiError ? e.message : "تغییر وضعیت ناموفق بود")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> چاپ فاکتور
      </Button>

      {canWrite ? (
        <Select value={current} disabled={pending} onValueChange={(v) => changeStatus(v as OrderStatus)}>
          <SelectTrigger size="sm" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {canRefund ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || current === "refunded"}
              className="text-destructive hover:text-destructive"
            >
              <RotateCcw className="size-4" /> بازپرداخت
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>بازپرداخت سفارش</AlertDialogTitle>
              <AlertDialogDescription>
                وضعیت سفارش به «بازپرداخت‌شده» تغییر می‌کند. این عمل قابل بازگشت نیست.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <AlertDialogAction onClick={() => changeStatus("refunded")}>
                تأیید بازپرداخت
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  )
}
