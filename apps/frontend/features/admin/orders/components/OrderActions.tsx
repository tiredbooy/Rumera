"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { ORDER_STATUS_FA } from "@/features/orders/labels"
import type { OrderStatus } from "@/features/orders/types"
import { AdminOrderClientError } from "@/features/orders/api/admin-client"
import { useUpdateAdminOrderStatus } from "@/features/admin/orders/hooks"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = (Object.keys(ORDER_STATUS_FA) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_FA[value],
}))

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
  const updateStatus = useUpdateAdminOrderStatus(orderId)

  async function changeStatus(next: OrderStatus) {
    const previous = current
    setCurrent(next) // optimistic
    try {
      await updateStatus.mutateAsync({ status: next })
      toast.success(`وضعیت سفارش به «${ORDER_STATUS_FA[next]}» تغییر کرد`)
      router.refresh()
    } catch (e) {
      setCurrent(previous) // roll back
      toast.error(e instanceof AdminOrderClientError ? e.message : "تغییر وضعیت ناموفق بود")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> چاپ فاکتور
      </Button>

      {canWrite ? (
        <Select value={current} disabled={updateStatus.isPending} onValueChange={(v) => changeStatus(v as OrderStatus)}>
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
    </div>
  )
}
