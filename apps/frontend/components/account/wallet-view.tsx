"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Wallet,
  Plus,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Award,
  RotateCcw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/products"
import { faDate } from "@/lib/catalog/labels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GiftCardRedeem } from "@/components/wallet/gift-card-redeem"
import {
  useWallet,
  useWalletTransactions,
  useTopUpWallet,
  type WalletTransaction,
} from "@/lib/api/account-hooks"
import { AccountSection } from "./account-section"
import { EmptyState } from "./empty-state"

const KIND_META: Record<string, { label: string; icon: LucideIcon }> = {
  topup: { label: "افزایش موجودی", icon: ArrowDownLeft },
  spend: { label: "خرید", icon: ArrowUpRight },
  refund: { label: "بازگشت وجه", icon: RotateCcw },
  gift: { label: "کارت هدیه", icon: Gift },
  reward: { label: "امتیاز باشگاه", icon: Award },
}

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "topup", label: "افزایش" },
  { value: "spend", label: "خرید" },
  { value: "refund", label: "بازگشت" },
  { value: "gift", label: "هدیه" },
  { value: "reward", label: "امتیاز" },
]

function TopUpDialog() {
  const topUp = useTopUpWallet()
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState("")
  const presets = [500_000, 1_000_000, 2_000_000]

  function submit() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("مبلغ معتبر وارد کنید")
      return
    }
    topUp.mutate(value, {
      onSuccess: () => {
        toast.success("درخواست افزایش موجودی ثبت شد")
        setAmount("")
        setOpen(false)
      },
      onError: () => toast.error("افزایش موجودی هم‌اکنون در دسترس نیست"),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> افزایش موجودی
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>افزایش موجودی کیف پول</DialogTitle>
          <DialogDescription>مبلغ موردنظر را وارد یا از مقادیر پیشنهادی انتخاب کنید.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  Number(amount) === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                )}
              >
                {formatPrice(p)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="topup-amount">مبلغ (تومان)</Label>
            <Input
              id="topup-amount"
              type="number"
              inputMode="numeric"
              dir="ltr"
              className="text-start"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={topUp.isPending}>
            {topUp.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            ادامه به پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function WalletView() {
  const wallet = useWallet()
  const txs = useWalletTransactions()
  const [filter, setFilter] = React.useState("all")

  const all = txs.data ?? []
  const visible = filter === "all" ? all : all.filter((t: WalletTransaction) => t.kind === filter)

  return (
    <>
      {/* Balance hero */}
      <div className="cellar-glow border-hairline mb-6 overflow-hidden rounded-3xl px-6 py-7 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" /> موجودی فعلی
            </div>
            {wallet.isLoading ? (
              <Skeleton className="mt-3 h-10 w-44" />
            ) : (
              <p className="mt-2 font-serif text-4xl text-foil">
                {wallet.data ? formatPrice(wallet.data.balance) : formatPrice(0)}
              </p>
            )}
          </div>
          <TopUpDialog />
        </div>
      </div>

      <div className="mb-6">
        <GiftCardRedeem />
      </div>

      {/* Transactions */}
      <AccountSection
        title="تراکنش‌ها"
        action={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        bodyClassName="p-0"
      >
        {txs.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : txs.isError ? (
          <div className="p-6 text-sm text-muted-foreground">
            خطا در دریافت تراکنش‌ها.{" "}
            <button
              type="button"
              onClick={() => txs.refetch()}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              تلاش دوباره
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="تراکنشی برای نمایش نیست"
            description={
              filter === "all"
                ? "پس از نخستین تراکنش، تاریخچهٔ کیف پول شما اینجا نمایش داده می‌شود."
                : "تراکنشی در این دسته یافت نشد."
            }
            className="border-0"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">نوع</TableHead>
                <TableHead className="text-start">توضیح</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead className="text-end">مبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t: WalletTransaction) => {
                const meta = KIND_META[t.kind] ?? { label: t.kind, icon: Wallet }
                const Icon = meta.icon
                const credit = t.amount >= 0
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="size-3" /> {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{faDate(t.created_at)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-end font-medium",
                        credit ? "text-emerald-500" : "text-foreground"
                      )}
                      dir="ltr"
                    >
                      {credit ? "+" : "−"}
                      {formatPrice(Math.abs(t.amount))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </AccountSection>
    </>
  )
}
