"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Tag,
  ImageOff,
  AlertTriangle,
  RotateCw,
  Inbox,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import type { Brand } from "@/lib/catalog/types"
import { AdminApiError, listBrands, deleteBrand } from "@/lib/api/admin-client"
import { Button } from "@/components/ui/button"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

/** Shared query key so mutations elsewhere (the form) can invalidate the list. */
export const BRANDS_QUERY_KEY = ["admin", "brands"] as const

/** Logo thumbnail with a graceful, branded fallback (never a broken image). */
function BrandLogo({ brand }: { brand: Brand }) {
  const [failed, setFailed] = React.useState(false)
  const url = brand.image_url?.trim()
  const hasImage = !!url && /^https?:\/\/.+/i.test(url) && !failed

  return (
    <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.04]">
      {hasImage ? (
        <Image
          src={url}
          alt={`لوگوی ${brand.title}`}
          fill
          sizes="44px"
          unoptimized
          className="object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : url ? (
        <ImageOff className="size-5 text-muted-foreground/70" aria-hidden />
      ) : (
        <Tag className="size-5 text-muted-foreground/70" aria-hidden />
      )}
    </span>
  )
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              برند
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              کشور
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              سال تأسیس
            </TableHead>
            <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  )
}

function LoadingRows() {
  return (
    <TableShell>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="border-border/40 hover:bg-transparent">
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell className="text-end">
            <Skeleton className="ms-auto size-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </TableShell>
  )
}

export function BrandsTable({
  canWrite,
  canDelete,
}: {
  canWrite: boolean
  canDelete: boolean
}) {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = React.useState<Brand | null>(null)

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: BRANDS_QUERY_KEY,
    queryFn: async () => (await listBrands()).results ?? [],
  })

  const deleteMutation = useMutation({
    mutationFn: (brand: Brand) => deleteBrand(brand.id),
    onSuccess: (_data, brand) => {
      toast.success(`«${brand.title}» حذف شد`)
      setPendingDelete(null)
      queryClient.invalidateQueries({ queryKey: BRANDS_QUERY_KEY })
    },
    onError: (e: unknown) => {
      toast.error(e instanceof AdminApiError ? e.message : "حذف برند ناموفق بود")
    },
  })

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isPending) {
    return <LoadingRows />
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="border-hairline flex flex-col items-center justify-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-medium">بارگذاری برندها ناموفق بود</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {error instanceof AdminApiError
            ? error.message
            : "ارتباط با سرور برقرار نشد. دوباره تلاش کنید."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RotateCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
          تلاش مجدد
        </Button>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center justify-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/60">
          <Inbox className="size-6 opacity-70" aria-hidden />
        </span>
        <p className="text-sm font-medium">هنوز برندی ثبت نشده است</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          اولین برند را اضافه کنید تا در فرم محصولات قابل انتخاب شود.
        </p>
        {canWrite ? (
          <Button size="sm" asChild className="mt-1">
            <Link href="/admin/brands/new">
              <Plus className="size-4" /> برند جدید
            </Link>
          </Button>
        ) : null}
      </div>
    )
  }

  // ── Populated ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
          {faNum(data.length)} برند
        </p>
        <TableShell>
          {data.map((brand) => (
            <TableRow key={brand.id} className="border-border/40 transition-colors">
              <TableCell>
                <Link
                  href={canWrite ? `/admin/brands/${brand.id}` : "#"}
                  className={cn(
                    "-m-2 flex items-center gap-3 rounded-xl p-2 transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                    canWrite ? "hover:bg-muted/40" : "pointer-events-none"
                  )}
                  aria-disabled={!canWrite}
                  tabIndex={canWrite ? undefined : -1}
                >
                  <BrandLogo brand={brand} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-medium">{brand.title}</span>
                    {brand.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {brand.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {brand.country || "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="tabular-nums text-muted-foreground">
                  {brand.founded_year ? faNum(brand.founded_year) : "—"}
                </span>
              </TableCell>
              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`عملیات برای ${brand.title}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild disabled={!canWrite}>
                      <Link href={`/admin/brands/${brand.id}`}>
                        <Pencil className="size-4" /> ویرایش
                      </Link>
                    </DropdownMenuItem>
                    {canDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingDelete(brand)}
                        >
                          <Trash2 className="size-4" /> حذف
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableShell>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !deleteMutation.isPending) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف برند</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.title}» مطمئن هستید؟ این عمل قابل بازگشت
              نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (pendingDelete) deleteMutation.mutate(pendingDelete)
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <RotateCw className="size-4 animate-spin" />
              ) : null}
              حذف برند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
