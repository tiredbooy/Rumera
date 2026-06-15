"use client"

import * as React from "react"
import { RotateCcw, Printer } from "lucide-react"
import { toast } from "sonner"

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
import type { FulfilmentStatus } from "@/lib/admin/data"

const STATUS_OPTIONS: { value: FulfilmentStatus; label: string }[] = [
  { value: "processing", label: "در حال پردازش" },
  { value: "packed", label: "بسته‌بندی" },
  { value: "shipped", label: "ارسال‌شده" },
  { value: "delivered", label: "تحویل‌شده" },
  { value: "cancelled", label: "لغوشده" },
]

export function OrderActions({
  status,
  canWrite,
  canRefund,
}: {
  status: FulfilmentStatus
  canWrite: boolean
  canRefund: boolean
}) {
  const [current, setCurrent] = React.useState<FulfilmentStatus>(status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => toast.success("فاکتور آماده چاپ شد (نمونه)")}>
        <Printer className="size-4" /> چاپ فاکتور
      </Button>

      {canWrite ? (
        <Select
          value={current}
          onValueChange={(v) => {
            setCurrent(v as FulfilmentStatus)
            toast.success(`وضعیت سفارش به «${STATUS_OPTIONS.find((o) => o.value === v)?.label}» تغییر کرد (نمونه)`)
          }}
        >
          <SelectTrigger size="sm" className="min-w-40">
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
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <RotateCcw className="size-4" /> بازپرداخت
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>بازپرداخت سفارش</AlertDialogTitle>
              <AlertDialogDescription>
                مبلغ کامل سفارش به کیف پول مشتری بازگردانده می‌شود. این عمل قابل بازگشت نیست.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <AlertDialogAction onClick={() => toast.success("بازپرداخت ثبت شد (نمونه)")}>
                تأیید بازپرداخت
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  )
}
