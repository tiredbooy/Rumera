"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  Phone,
} from "lucide-react";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAddresses, useCreateAddress } from "@/lib/api/hooks";
import {
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from "@/lib/api/account-hooks";
import type { Address, AddressInput } from "@/lib/catalog/types";
import { AccountSection } from "../../account/components/account-section";
import { EmptyState } from "../../EmptyState";
import { AddressForm } from "./address-form";

export function AddressesView() {
  const { data, isLoading, isError, refetch } = useAddresses();
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [editing, setEditing] = React.useState<Address | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Address | null>(null);

  const dialogOpen = creating || editing !== null;

  function closeDialog() {
    setCreating(false);
    setEditing(null);
  }

  function handleSubmit(values: AddressInput) {
    if (editing) {
      update.mutate(
        { id: editing.id, input: values },
        {
          onSuccess: () => {
            toast.success("آدرس به‌روزرسانی شد");
            closeDialog();
          },
          onError: () => toast.error("به‌روزرسانی ناموفق بود"),
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: () => {
          toast.success("آدرس جدید ثبت شد");
          closeDialog();
        },
        onError: () => toast.error("ثبت آدرس ناموفق بود"),
      });
    }
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> آدرس جدید
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl border-dashed bg-card/40 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <MapPin className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            خطا در دریافت آدرس‌ها.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            تلاش دوباره
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="هنوز آدرسی ثبت نشده"
          description="برای تسریع در ثبت سفارش، نخستین آدرس تحویل خود را اضافه کنید."
          actionLabel="افزودن آدرس"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((addr) => (
            <AccountSection
              key={addr.id}
              className={
                addr.is_default
                  ? "ring-primary/30 transition-colors"
                  : "transition-colors hover:ring-foreground/10"
              }
              title={
                <span className="flex items-center gap-2">
                  {addr.title || "آدرس"}
                  {addr.is_default ? (
                    <Badge className="gap-1 bg-gold text-gold-foreground">
                      <Star className="size-3 fill-current" /> پیش‌فرض
                    </Badge>
                  ) : null}
                </span>
              }
              action={
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="ویرایش آدرس"
                    onClick={() => setEditing(addr)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف آدرس"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setToDelete(addr)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              }
            >
              <p className="font-medium">{addr.full_name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {addr.state_province ? `${addr.state_province}، ` : ""}
                {addr.city}، {addr.address_line1}
                {addr.address_line2 ? `، ${addr.address_line2}` : ""}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>کد پستی: {faNum(Number(addr.postal_code) || 0)}</span>
                {addr.phone_number ? (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <Phone className="size-3" /> {addr.phone_number}
                  </span>
                ) : null}
              </p>
              {!addr.is_default ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={setDefault.isPending}
                  onClick={() =>
                    setDefault.mutate(addr.id, {
                      onSuccess: () => toast.success("آدرس پیش‌فرض تنظیم شد"),
                      onError: () => toast.error("عملیات ناموفق بود"),
                    })
                  }
                >
                  <Star className="size-4" /> تنظیم به‌عنوان پیش‌فرض
                </Button>
              ) : null}
            </AccountSection>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => (o ? null : closeDialog())}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "ویرایش آدرس" : "آدرس جدید"}</DialogTitle>
            <DialogDescription>
              اطلاعات گیرنده و نشانی تحویل را وارد کنید.
            </DialogDescription>
          </DialogHeader>
          <AddressForm
            defaultValues={editing ?? undefined}
            submitting={create.isPending || update.isPending}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => (o ? null : setToDelete(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف آدرس</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این آدرس مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!toDelete) return;
                const id = toDelete.id;
                remove.mutate(id, {
                  onSuccess: () => toast.success("آدرس حذف شد"),
                  onError: () => toast.error("حذف ناموفق بود"),
                });
                setToDelete(null);
              }}
            >
              {remove.isPending ? (
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
