"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Loader2, ArrowLeft, ArrowRight, Check, Sparkles, Wine, Wallet, HeartHandshake } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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

const STEPS: { title: string; icon: LucideIcon }[] = [
  { title: "دسته‌بندی", icon: Wine },
  { title: "بودجه", icon: Wallet },
  { title: "ذائقه", icon: HeartHandshake },
]

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
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors duration-200",
        active
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-secondary text-secondary-foreground ring-transparent hover:bg-accent"
      )}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </button>
  )
}

export function TasteQuiz() {
  const { data, isLoading } = useTasteProfile()
  const save = useSaveTasteProfile()
  const reduceMotion = useReducedMotion()

  const [step, setStep] = React.useState(0)
  // Direction drives the slide animation: +1 forward, -1 back.
  const [dir, setDir] = React.useState(1)
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

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

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
      <div className="border-hairline flex h-56 items-center justify-center rounded-3xl bg-card/60 ring-1 ring-foreground/5">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (done) {
    const topCat = cats[0] as Category | undefined
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="cellar-glow border-hairline overflow-hidden rounded-3xl p-8 text-center ring-1 ring-foreground/10"
      >
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Check className="size-7" />
        </div>
        <p className="eyebrow justify-center">
          <Sparkles className="size-3.5" /> سلیقهٔ شما
        </p>
        <h2 className="mt-2 font-serif text-3xl">سلیقهٔ شما ثبت شد</h2>
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
          از این پس پیشنهادها بر اساس انتخاب‌های شما شخصی‌سازی می‌شوند.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {topCat ? (
            <Button asChild>
              <Link href={`/categories/${topCat.toLowerCase()}`}>
                مشاهدهٔ {categoryFa[topCat]} <ArrowLeft className="size-4" />
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setDone(false)
              go(0)
            }}
          >
            ویرایش سلیقه
          </Button>
        </div>
      </motion.div>
    )
  }

  const StepIcon = STEPS[step].icon
  const stepEyebrow = `گام ${faNum(step + 1)} از ${faNum(STEPS.length)}`

  // Slide variants honour RTL: forward enters from the inline-start (left edge
  // visually in RTL) using a signed x offset multiplied by direction.
  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * 28 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * -28 }),
  }

  return (
    <div className="border-hairline overflow-hidden rounded-3xl bg-card/60 p-6 ring-1 ring-foreground/5 sm:p-8">
      {/* Stepper */}
      <ol className="mb-7 flex items-center gap-2" aria-label="مراحل سلیقه‌سنجی">
        {STEPS.map((s, i) => {
          const Ico = s.icon
          const reached = i <= step
          return (
            <React.Fragment key={s.title}>
              <li className="flex items-center gap-2">
                <span
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-xs font-semibold ring-1 transition-colors duration-300",
                    reached
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-secondary text-muted-foreground ring-transparent"
                  )}
                >
                  {i < step ? <Check className="size-4" /> : <Ico className="size-4" />}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:inline",
                    reached ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </span>
              </li>
              {i < STEPS.length - 1 ? (
                <span className="h-px flex-1 overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="block h-full bg-primary"
                    initial={false}
                    animate={{ scaleX: i < step ? 1 : 0 }}
                    style={{ transformOrigin: "right" }}
                    transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}
                  />
                </span>
              ) : null}
            </React.Fragment>
          )
        })}
      </ol>

      {/* Animated step body */}
      <div className="relative min-h-[15rem]">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow mb-2">
              <StepIcon className="size-3.5" /> {stepEyebrow}
            </p>

            {step === 0 ? (
              <>
                <h2 className="font-serif text-2xl sm:text-3xl">چه چیزهایی را بیشتر می‌پسندید؟</h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  یک یا چند دسته را انتخاب کنید.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {categories.map((c) => (
                    <Chip key={c.name} active={cats.includes(c.name)} onClick={() => setCats(toggle(cats, c.name))}>
                      {categoryFa[c.name]}
                    </Chip>
                  ))}
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h2 className="font-serif text-2xl sm:text-3xl">بودجهٔ معمول شما برای هر بطری؟</h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  این به ما کمک می‌کند پیشنهادهای متناسب با بودجه‌تان بدهیم.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {budgets.map((b) => (
                    <Chip key={b.label} active={budget === b.value} onClick={() => setBudget(b.value)}>
                      {b.label}
                    </Chip>
                  ))}
                </div>
                {budget && budget > 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">سقف انتخابی: {formatPrice(budget)}</p>
                ) : null}
              </>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl sm:text-3xl">ذائقه و مناسبت</h2>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    برای پیشنهادهای دقیق‌تر (اختیاری).
                  </p>
                </div>
                <div>
                  <p className="mb-2.5 text-sm font-medium">طعم مورد علاقه</p>
                  <div className="flex flex-wrap gap-2.5">
                    {flavors.map((f) => (
                      <Chip key={f} active={flavor.includes(f)} onClick={() => setFlavor(toggle(flavor, f))}>
                        {f}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2.5 text-sm font-medium">بیشتر برای چه مناسبتی؟</p>
                  <div className="flex flex-wrap gap-2.5">
                    {occasions.map((o) => (
                      <Chip key={o} active={occ.includes(o)} onClick={() => setOcc(toggle(occ, o))}>
                        {o}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/60 pt-6">
        <Button
          variant="ghost"
          onClick={() => go(Math.max(0, step - 1))}
          disabled={step === 0}
          className="cursor-pointer"
        >
          <ArrowRight className="size-4" /> قبلی
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => go(step + 1)}
            disabled={step === 0 && cats.length === 0}
            className="cursor-pointer"
          >
            بعدی <ArrowLeft className="size-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={save.isPending} className="cursor-pointer">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            ذخیرهٔ سلیقه
          </Button>
        )}
      </div>
    </div>
  )
}
