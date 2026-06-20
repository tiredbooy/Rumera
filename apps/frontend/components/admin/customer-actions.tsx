"use client"

import * as React from "react"
import Link from "next/link"
import { Ban, ShieldCheck, Pencil } from "lucide-react"
import { toast } from "sonner"

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { CustomerStatus } from "@/lib/admin/data"

export function CustomerActions({
  name,
  status,
  canWrite,
  canBan,
  editHref,
}: {
  name: string
  status: CustomerStatus
  canWrite: boolean
  canBan: boolean
  /** Link to the edit-user screen; rendered only when the admin can write. */
  editHref: string
}) {
  const [banned, setBanned] = React.useState(status === "banned")

  return (
    <div className="flex items-center gap-2">
      {canWrite ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={editHref}>
            <Pencil className="size-4" /> ویرایش
          </Link>
        </Button>
      ) : null}

      {canBan ? (
        banned ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBanned(false)
              toast.success(`دسترسی «${name}» بازگردانده شد (نمونه)`)
            }}
          >
            <ShieldCheck className="size-4" /> رفع مسدودی
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Ban className="size-4" /> مسدودسازی
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>مسدودسازی مشتری</AlertDialogTitle>
                <AlertDialogDescription>
                  «{name}» دیگر نمی‌تواند وارد حساب شود یا سفارش ثبت کند. می‌توانید بعداً رفع مسدودی کنید.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>انصراف</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setBanned(true)
                    toast.success(`«${name}» مسدود شد (نمونه)`)
                  }}
                >
                  مسدود کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      ) : null}
    </div>
  )
}
