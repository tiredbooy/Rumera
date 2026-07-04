"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GalleryHorizontalEnd,
  AlertCircle,
  RotateCw,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SmartImage } from "@/components/smart-image"
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
  AdminApiError,
  listHeroSlides,
  updateHeroSlide,
  deleteHeroSlide,
  type HeroSlide,
} from "@/lib/api/admin-client"

const heroKeys = {
  all: ["admin", "hero-slides"] as const,
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        active
          ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
          : "bg-muted text-muted-foreground ring-border/60"
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/50")}
      />
      {active ? "فعال" : "غیرفعال"}
    </span>
  )
}

export function HeroSlidesBoard({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient()
  const [pendingDelete, setPendingDelete] = React.useState<HeroSlide | null>(null)
  // Tracks which slide id has an in-flight reorder so its buttons can disable.
  const [movingId, setMovingId] = React.useState<number | null>(null)

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: heroKeys.all,
    queryFn: listHeroSlides,
  })

  // Stable display order: by sort_order, then id (mirrors the public API).
  const slides = React.useMemo(
    () =>
      [...(data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [data]
  )

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteHeroSlide(id),
    onSuccess: () => {
      toast.success("اسلاید حذف شد")
      qc.invalidateQueries({ queryKey: heroKeys.all })
    },
    onError: (e) => {
      toast.error(e instanceof AdminApiError ? e.message : "حذف اسلاید ناموفق بود")
    },
    onSettled: () => setPendingDelete(null),
  })

  // Swap two adjacent slides' sort_order to move one up/down. Optimistic-free,
  // small payloads (two PATCHes), then refetch for the source of truth.
  async function move(index: number, direction: -1 | 1) {
    const a = slides[index]
    const b = slides[index + direction]
    if (!a || !b) return
    setMovingId(a.id)
    try {
      await Promise.all([
        updateHeroSlide(a.id, { sort_order: b.sort_order }),
        updateHeroSlide(b.id, { sort_order: a.sort_order }),
      ])
      await qc.invalidateQueries({ queryKey: heroKeys.all })
    } catch (e) {
      toast.error(e instanceof AdminApiError ? e.message : "جابه‌جایی ترتیب ناموفق بود")
    } finally {
      setMovingId(null)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="border-hairline overflow-hidden rounded-2xl bg-card">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-2 p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div
        role="alert"
        className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-12 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </span>
        <p className="font-serif text-base">بارگذاری اسلایدها ناموفق بود</p>
        <p className="text-sm text-muted-foreground">
          ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="size-4" /> تلاش دوباره
        </Button>
      </div>
    )
  }

  // ── Empty ───────────────────────────────────────────────────────────────────
  if (slides.length === 0) {
    return (
      <div className="border-hairline cellar-glow flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
          <GalleryHorizontalEnd className="size-7" />
        </span>
        <p className="font-serif text-lg">هنوز اسلایدی ساخته نشده است</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          اولین بنر هیرو را بسازید تا در کاروسل صفحهٔ اصلی فروشگاه نمایش داده شود.
        </p>
        {canWrite ? (
          <Button asChild className="mt-1">
            <Link href="/admin/hero-slides/new">
              <Plus className="size-4" /> ساخت اولین اسلاید
            </Link>
          </Button>
        ) : null}
      </div>
    )
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <>
      <ul
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy={isFetching}
        data-testid="hero-slides-list"
      >
        {slides.map((slide, i) => {
          const busy = movingId === slide.id
          return (
            <li
              key={slide.id}
              data-slide-id={slide.id}
              className="border-hairline group flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] transition-shadow hover:shadow-e1"
            >
              {/* Thumbnail — storefront 16:9 crop */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                <SmartImage
                  src={slide.image_url || null}
                  alt={slide.image_alt ?? slide.title}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  fallbackClassName="from-card via-card to-background"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
                  <StatusPill active={slide.is_active} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
                    ترتیب {faNum(slide.sort_order)}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4">
                {slide.eyebrow ? (
                  <p className="truncate text-xs font-semibold text-primary">{slide.eyebrow}</p>
                ) : null}
                <p className="mt-0.5 line-clamp-1 font-serif text-base leading-snug">
                  {slide.title}
                </p>
                {slide.subtitle ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {slide.subtitle}
                  </p>
                ) : null}

                {slide.cta_label && slide.cta_href ? (
                  <p className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground">
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{slide.cta_label}</span>
                    <span dir="ltr" className="truncate text-muted-foreground/70">
                      {slide.cta_href}
                    </span>
                  </p>
                ) : null}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                  {canWrite ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`انتقال «${slide.title}» به بالا`}
                        disabled={i === 0 || busy}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`انتقال «${slide.title}» به پایین`}
                        disabled={i === slides.length - 1 || busy}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                      asChild
                    >
                      <Link href={`/admin/hero-slides/${slide.id}`}>
                        <Pencil className="size-4" /> ویرایش
                      </Link>
                    </Button>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`حذف «${slide.title}»`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(slide)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف اسلاید</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              حذف اسلاید
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
