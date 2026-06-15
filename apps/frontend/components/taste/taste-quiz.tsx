"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTasteProfile, useSaveTasteProfile, type TastePrefs } from "@/lib/api/hooks"
import { categories, categoryFa, faNum, formatPrice, type Category } from "@/lib/products"

const budgets = [
  { label: "تا ۵ میلیون", value: 5_000_000 },
  { label: "تا ۱۰ میلیون", value: 10_000_000 },
  { label: "تا ۲۰ میلیون", value: 20_000_000 },
  { label: "بدون محدودیت", value: 0 },
]
const flavors = ["ملایم", "خشک", "دودی", "میوه‌ای", "تلخ", "شیرین"]
const occasions = ["مهمانی", "هدیه", "لذت شخصی", "جشن"]

const STEPS = ["دسته‌بندی", "بودجه", "ذائقه"]

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  )
}

export function TasteQuiz() {
  const { data, isLoading } = useTasteProfile()
  const save = useSaveTasteProfile()

  const [step, setStep] = React.useState(0)
  const [cats, setCats] = React.useState<string[]>([])
  const [budget, setBudget] = React.useState<number | null>(null)
  const [flavor, setFlavor] = React.useState<string[]>([])
  const [occ, setOcc] = React.useState<string[]>([])
  const [done, setDone] = React.useState(false)

  // Prefill once the saved profile loads.
  const hydrated = React.useRef(false)
  React.useEffect(() => {
    if (hydrated.current || !data) return
    hydrated.current = true
    setCats(data.categories ?? [])
    setBudget(typeof data.budget_max === "number" ? data.budget_max : null)
    setFlavor(data.flavor ?? [])
    setOcc(data.occasions ?? [])
  }, [data])

  function finish() {
    const prefs: TastePrefs = {
      categories: cats,
      budget_max: budget ?? 0,
      flavor,
      occasions: occ,
    }
    save.mutate(prefs, {
      onSuccess: () => {
        setDone(true)
        toast.success("سلیقهٔ شما ذخیره شد")
      },
      onError: () => toast.error("ذخیره ناموفق بود"),
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (done) {
    const topCat = cats[0] as Category | undefined
    return (
      <div className="border-hairline rounded-3xl bg-card/60 p-8 text-center ring-1 ring-foreground/5">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Check className="size-6" />
        </div>
        <h2 className="font-serif text-2xl">سلیقهٔ شما ثبت شد</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          پیشنهادها بر اساس انتخاب‌های شما شخصی‌سازی می‌شوند.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {topCat ? (
            <Button asChild>
              <Link href={`/categories/${topCat.toLowerCase()}`}>
                مشاهدهٔ {categoryFa[topCat]} <ArrowLeft />
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => { setDone(false); setStep(0) }}>
            ویرایش سلیقه
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-hairline rounded-3xl bg-card/60 p-6 ring-1 ring-foreground/5 sm:p-8">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i <= step ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              {faNum(i + 1)}
            </span>
            {i < STEPS.length - 1 ? (
              <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {step === 0 ? (
        <div>
          <p className="eyebrow mb-2"><Sparkles className="size-3.5" /> گام ۱</p>
          <h2 className="font-serif text-2xl">چه چیزهایی را بیشتر می‌پسندید؟</h2>
          <p className="mt-1 text-sm text-muted-foreground">یک یا چند دسته را انتخاب کنید.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.name} active={cats.includes(c.name)} onClick={() => setCats(toggle(cats, c.name))}>
                {categoryFa[c.name]}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <p className="eyebrow mb-2"><Sparkles className="size-3.5" /> گام ۲</p>
          <h2 className="font-serif text-2xl">بودجهٔ معمول شما برای هر بطری؟</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {budgets.map((b) => (
              <Chip key={b.label} active={budget === b.value} onClick={() => setBudget(b.value)}>
                {b.label}
              </Chip>
            ))}
          </div>
          {budget && budget > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">سقف: {formatPrice(budget)}</p>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div>
            <p className="eyebrow mb-2"><Sparkles className="size-3.5" /> گام ۳</p>
            <h2 className="font-serif text-2xl">ذائقه و مناسبت</h2>
            <p className="mt-1 text-sm text-muted-foreground">برای پیشنهادهای بهتر (اختیاری).</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">طعم مورد علاقه</p>
            <div className="flex flex-wrap gap-2">
              {flavors.map((f) => (
                <Chip key={f} active={flavor.includes(f)} onClick={() => setFlavor(toggle(flavor, f))}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">بیشتر برای چه مناسبتی؟</p>
            <div className="flex flex-wrap gap-2">
              {occasions.map((o) => (
                <Chip key={o} active={occ.includes(o)} onClick={() => setOcc(toggle(occ, o))}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="cursor-pointer"
        >
          <ArrowRight className="size-4" /> قبلی
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && cats.length === 0}
            className="cursor-pointer"
          >
            بعدی <ArrowLeft className="size-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={save.isPending} className="cursor-pointer">
            {save.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            ذخیرهٔ سلیقه
          </Button>
        )}
      </div>
    </div>
  )
}
