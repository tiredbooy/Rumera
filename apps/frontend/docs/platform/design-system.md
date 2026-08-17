# Design System & Theming

The Rumera storefront is a Persian (Farsi, RTL) luxury wine & spirits experience. Its
visual language is **warm cellar neutrals + aged-gold primary + deep wine accent**, with two
themes: a daytime **parchment** light theme and the headline **candle-lit cellar** dark theme.

This document covers the design tokens, the custom utility vocabulary, typography, RTL
conventions, the number/date/price helpers, the shadcn/ui primitive set, and theme switching.
Everything here is defined in one of:

| Concern | File |
|---|---|
| Tokens, themes, utilities, animations | [`app/globals.css`](../../app/globals.css) |
| Fonts, `<html dir lang>`, metadata | [`app/layout.tsx`](../../app/layout.tsx) |
| Theme + direction + query providers | [`app/providers.tsx`](../../app/providers.tsx) |
| `cn()` class merge | [`lib/utils.ts`](../../lib/utils.ts) |
| `faNum` / `formatPrice` | [`lib/products.ts`](../../lib/products.ts) |
| `faDate` + order labels | [`lib/catalog/labels.ts`](../../lib/catalog/labels.ts) |
| shadcn config | [`components.json`](../../components.json) |
| Primitives | [`components/ui/*`](../../components/ui) |

> There is **no `tailwind.config.js`**. This is Tailwind v4 — configuration lives in CSS via
> `@theme inline { … }` inside `globals.css`, and PostCSS is wired through
> [`postcss.config.mjs`](../../postcss.config.mjs) (`@tailwindcss/postcss`). The shadcn registry
> style is `radix-rhea` with `cssVariables: true`.

---

## 1. Design tokens & CSS variables

All colors are authored in **OKLCH** for perceptually-even theming. The raw values live on
`:root` (light) and `.dark` (dark); the `@theme inline` block then re-exports each one as a
Tailwind color/token so you write `bg-gold`, `text-wine`, `shadow-e2`, `rounded-2xl`, etc.

```
globals.css structure
─────────────────────
@theme inline { … }   ← maps --gold → color-gold, --elev-1 → shadow-e1, --radius → radius-*
:root { … }           ← LIGHT theme raw OKLCH values (parchment & ink)
.dark { … }           ← DARK theme raw OKLCH values (candle-lit cellar)  ← app default
@layer base { … }     ← element resets, font wiring, heading rules
@layer components {}   ← .eyebrow .cellar-glow .glass .prose-rumera …
@utility container-px  ← responsive horizontal page padding
```

### Brand & semantic colors

The brand tokens are the headline of the system. The standard shadcn semantic tokens
(`background`, `foreground`, `card`, `primary`, `muted`, `accent`, `destructive`, `border`,
`ring`, `sidebar-*`, `chart-1..5`) are also present and theme-aware.

| Token | Tailwind class | Light (`:root`) | Dark (`.dark`) | Use |
|---|---|---|---|---|
| `--gold` | `bg-gold` `text-gold` `border-gold` | `oklch(0.66 0.13 72)` | `oklch(0.82 0.13 80)` | Primary / brand action, also `--primary` |
| `--gold-foreground` | `text-gold-foreground` | dark ink | dark ink | Text on gold |
| `--wine` | `bg-wine` `text-wine` | `oklch(0.42 0.14 18)` | `oklch(0.55 0.16 20)` | Accent: sale badges, wishlist active |
| `--wine-foreground` | `text-wine-foreground` | parchment | parchment | Text on wine |
| `--primary` | `bg-primary` `text-primary` | same as gold | same as gold | Semantic alias of gold |

`--primary` and `--gold` are intentionally the same value — gold **is** the primary. Prefer
the semantic `text-primary` for "interactive accent" and `bg-gold`/`text-wine` when you mean
the literal brand swatch (badges, foil, glows).

### Radius scale

A single `--radius: 0.75rem` drives a derived scale. The **`rounded-2xl` card** is the house
convention; primitives go further (cards use `rounded-[min(var(--radius-4xl),24px)]`).

| Class | Value |
|---|---|
| `rounded-sm` | `radius × 0.6` |
| `rounded-md` | `radius × 0.8` |
| `rounded-lg` | `radius` (0.75rem) |
| `rounded-xl` | `radius × 1.4` |
| `rounded-2xl` | `radius × 1.8` |
| `rounded-3xl` | `radius × 2.2` |
| `rounded-4xl` | `radius × 2.6` |

### Elevation (shadows)

Warm, low-spread shadows tuned per theme — ink-tinted on parchment, near-black on the cellar
theme to give depth without a grey haze. `shadow-glow` is a colored gold bloom for CTAs/hero.

| Class | Var | Role |
|---|---|---|
| `shadow-e1` | `--elev-1` | Resting cards, `.glass` |
| `shadow-e2` | `--elev-2` | Raised panels, popovers |
| `shadow-e3` | `--elev-3` | Hover lift / modal-level |
| `shadow-glow` | `--elev-glow` | Gold glow for premium CTAs/hero |

### Motion

| Token | Value | Meaning |
|---|---|---|
| `--ease-cellar` | `cubic-bezier(0.22, 1, 0.36, 1)` | Calm decelerate (default house easing) |
| `--ease-cellar-in` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric ease for in/out |
| `--animate-duration` | `320ms` | Default animation duration |

Consume in markup via Tailwind's arbitrary-value support (`ease-[var(--ease-cellar)]`) or
reference the var directly in a custom class (see `.hover-lift`, `.press` below). All motion
honors `prefers-reduced-motion` — the marquee stops, `.hover-lift` does not translate, and
`scroll-behavior` drops to `auto`.

---

## 2. Custom utility classes

Defined in `@layer components` of `globals.css`. These are the shared "redesign vocabulary"
used app-wide.

| Class | What it does |
|---|---|
| `.eyebrow` | Small bold gold label above section titles. `inline-flex items-center gap-2 text-sm font-semibold text-primary` |
| `.section-title` | Serif display heading: `font-serif text-4xl leading-tight sm:text-5xl` |
| `.cellar-glow` | Warm dual radial spotlight (gold top, wine bottom) for hero/feature backgrounds |
| `.text-foil` | Gold-foil gradient text (clipped to glyphs) for the wordmark & display numbers |
| `.glass` | Signature floating surface: `border-border/60 bg-card/70 backdrop-blur-xl` + `shadow-e1` |
| `.border-hairline` | `border border-border/70` — a soft 1px hairline |
| `.rule-gold` | 1px horizontal gold gradient rule between editorial sections |
| `.hover-lift` | Card hover: `ring-1 ring-foreground/5` resting → lifts `-translate-y-1`, warms ring, `shadow-e3`. Flat under reduced-motion |
| `.press` | Tactile `scale-[0.985]` press feedback on `:active` |
| `.sheen` | Diagonal light sweep overlay for CTAs (place absolutely inside a `group`, reveal on hover) |
| `.fade-x` | Horizontal edge-fade mask for marquees / overflow rows |
| `.animate-marquee` | Pure-CSS infinite marquee (`--marquee-duration` default 40s, pauses on hover) |
| `.prose-rumera` | Long-form editorial typography (Journal, Recipes, About) |
| `.prose-recipe` | Denser in-editor variant for the admin recipe rich-text editor |
| `@utility container-px` | Responsive page gutter: `px-5 sm:px-8 lg:px-12` |

### The card convention

The house pattern for any tile/surface is a **rounded-2xl card on `bg-card` with a faint
inner ring**, optionally combined with `.hover-lift`:

```tsx
<article className="border-hairline rounded-2xl bg-card ring-1 ring-foreground/5
                    transition-all duration-300 hover:-translate-y-1.5
                    hover:ring-primary/30 sm:rounded-3xl">
  …
</article>
```

The shadcn `<Card>` ([`components/ui/card.tsx`](../../components/ui/card.tsx)) bakes this in:
`rounded-[min(var(--radius-4xl),24px)] bg-card … ring-1 ring-foreground/5 dark:ring-foreground/10`.
`ring-1 ring-foreground/5` (a near-invisible separating ring) appears throughout — prefer it
over a hard `border` for surfaces that float on the parchment/cellar background.

### `.prose-rumera` (editorial body)

Tuned for Persian: generous `leading-[1.95]`, serif headings, gold links/markers, RTL-safe
logical properties (`ps-5`, `border-s-2`), no letter-spacing. Wrap any article body in it.

---

## 3. Typography

Three Google fonts are loaded in [`app/layout.tsx`](../../app/layout.tsx) via `next/font/google`
and exposed as CSS variables consumed by `@theme inline`:

| Font | CSS var → token | Role |
|---|---|---|
| **Vazirmatn** | `--font-sans` → `font-sans` | All body + UI copy (modern Persian UI face) |
| **Markazi Text** | `--font-serif` → `font-serif` / `font-heading` | Display headings & the wordmark (editorial serif) |
| **Geist Mono** | `--font-mono` → `font-mono` | Monospace |

`--font-heading` is aliased to `--font-serif`, so `font-heading` and `font-serif` are
equivalent. In `@layer base`, `h1–h4` and `.font-heading` are forced to `font-serif` with
`letter-spacing: normal`.

> **Persian script rule (important):** Persian/Arabic is cursive — letters join. Both
> `uppercase` and `tracking-*` break that joining. **Never apply `uppercase` or
> `tracking-*` to Persian copy.** Headings keep natural spacing; the `.eyebrow` is bold +
> colored rather than tracked uppercase, exactly because of this.

`body` enables ligatures via `font-feature-settings: "liga" 1, "calt" 1`.

---

## 4. RTL conventions

The document is RTL globally: `<html lang="fa" dir="rtl">` in the root layout, and a Radix
**`DirectionProvider dir="rtl"`** ([`components/ui/direction.tsx`](../../components/ui/direction.tsx))
wraps the tree in `providers.tsx` so primitives (menus, sliders, carousels) flip correctly.
The toaster is also `dir="rtl"`.

**Rule: use logical properties only — never physical `left`/`right`.** This keeps a single
codebase correct under RTL.

| Use (logical) | Not (physical) |
|---|---|
| `ps-*` / `pe-*` | `pl-*` / `pr-*` |
| `ms-*` / `me-*` | `ml-*` / `mr-*` |
| `start-*` / `end-*` | `left-*` / `right-*` |
| `border-s` / `border-e` | `border-l` / `border-r` |
| `rounded-s-*` / `rounded-e-*` | `rounded-l-*` / `rounded-r-*` |
| `text-start` / `text-end` | `text-left` / `text-right` |

You can see this live in [`components/product-card.tsx`](../../components/product-card.tsx): badges
pin to `start-3 top-3`, the wishlist button to `end-3 top-3` — both follow reading direction
automatically. (A few low-level shadcn primitives use physical insets internally; that is
their inherited implementation. Application code stays logical.)

---

## 5. Number / date / price helpers

Persian users expect Persian digits (۰۱۲۳۴…), Persian grouping, and Toman pricing. These
helpers use `Intl` with the `fa-IR` locale — do not hand-roll digit conversion or hardcode
"تومان".

| Helper | Where | Output | Use |
|---|---|---|---|
| `faNum(value: number)` | [`lib/products.ts`](../../lib/products.ts) | `Intl.NumberFormat("fa-IR")` → e.g. `۱۸٬۹۰۰` | Any displayed integer/decimal (ratings, counts, ABV, volume) |
| `faTick` / `faMoneyTick` | [`lib/charts/format.ts`](../../lib/charts/format.ts) | `faNum` tick; millions + «م» (e.g. `۱۸م`) | Admin chart axes (import from `@/lib/charts`) |
| `formatPrice(value: number)` | [`lib/products.ts`](../../lib/products.ts) | `«۱۸٬۹۰۰٬۰۰۰ تومان»` (0 fraction digits) | Prices |
| `faDate(iso: string)` | [`lib/catalog/labels.ts`](../../lib/catalog/labels.ts) | `Intl.DateTimeFormat("fa-IR", {dateStyle:"medium"})`, falls back to the raw string on error | Order/blog dates |

```tsx
import { faNum, formatPrice } from "@/lib/products"
import { faDate } from "@/lib/catalog/labels"

<span>{formatPrice(product.price)}</span>          // ۱۸٬۹۰۰٬۰۰۰ تومان
<span>{faNum(product.rating)} ({faNum(product.reviews)})</span>
<time>{faDate(order.createdAt)}</time>
```

> Note: there are two `faDate` definitions — the canonical export in `lib/catalog/labels.ts`,
> and a small local copy inside
> [`components/catalog/reviews-section.tsx`](../../components/catalog/reviews-section.tsx). Both
> use the same `fa-IR`/`medium` formatter; prefer importing from `lib/catalog/labels.ts`.

Related Persian label maps (also in `lib/products.ts` / `lib/catalog/labels.ts`):
`categoryFa`, `badgeFa`, `ORDER_STATUS_FA`, `PAYMENT_FA`. Use these to translate enum-ish
values rather than inlining strings.

---

## 6. shadcn/ui primitive set

Primitives live in [`components/ui/`](../../components/ui) (alias `@/components/ui`). They are
Radix-backed (`radix-ui`), styled with the OKLCH tokens above, and use the **`cva` + `cn`**
pattern with `data-slot` / `data-variant` / `data-size` attributes for styling hooks.

Available primitives (imported; unused shadcn copies were removed in PR-090i):

```
accordion        checkbox       input-otp                 separator
alert-dialog     collapsible    jalali-datetime-input     sheet
avatar           command        label                     skeleton
badge            dialog         native-select             sonner (toaster)
button           direction      popover                   switch
card             dropdown-menu  progress                  table
                 field          select                    tabs
                 input          textarea
                 input-group    toggle / toggle-group
```

`components/ui/direction.tsx` re-exports Radix's `DirectionProvider`/`useDirection` and is the
RTL backbone. `components/ui/sonner.tsx` is the toast surface (`<Toaster>` mounted in the root
layout, `position="bottom-left" dir="rtl"`).

Admin analytics charts import **TanStack Charts** from `@/lib/charts` (`RumeraChart`).
Orders use blue `oklch(0.62 0.16 250)`; revenue uses gold `oklch(0.72 0.15 75)`.
Tick/tooltip numerals stay `faNum`.
See [admin-console.md](../features/admin-console.md#analytics-charts).

### `cn()` and variants

[`lib/utils.ts`](../../lib/utils.ts) exports `cn(...inputs)` = `twMerge(clsx(inputs))`. Use it for
**every** className that mixes a base + conditional + caller override so later Tailwind classes
correctly win.

```tsx
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("…base…", { variants: { variant: {…}, size: {…} }, … })
className={cn(buttonVariants({ variant, size, className }))}
```

`<Button>` variants: `default` (gold), `outline`, `secondary`, `ghost`, `destructive`, `link`.
Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. Buttons are
`rounded-2xl` with a focus ring (`focus-visible:ring-3 ring-ring/30`) and a subtle press
nudge (`active:translate-y-px`). Pass `asChild` to render as a `Slot` (e.g. wrapping a
`next/link`).

### `SmartImage`

[`components/smart-image.tsx`](../../components/smart-image.tsx) wraps `next/image` (`fill`) with
an on-brand fallback: when `src` is missing or errors, it renders a `.cellar-glow` gradient
tile with a `.text-foil` monogram (default `ر`) and optional label, so no surface ever shows a
broken image. The parent must be `relative` and sized.

---

## 7. Theme switching

Wiring (in [`app/providers.tsx`](../../app/providers.tsx)):

```tsx
<ThemeProvider
  attribute="class"          // toggles the `.dark` class on <html>
  defaultTheme="dark"        // candle-lit cellar is the default look
  enableSystem               // respects OS preference
  disableTransitionOnChange  // no color flash while switching
>
```

- `ThemeProvider` ([`components/theme-provider.tsx`](../../components/theme-provider.tsx)) is a thin
  pass-through to **next-themes**.
- Because `attribute="class"`, the dark theme is selected by the `.dark` class on `<html>`,
  which is exactly what the `.dark { … }` block in `globals.css` and the
  `@custom-variant dark (&:is(.dark *))` target. Write theme-specific styling with the
  `dark:` variant.
- `<html suppressHydrationWarning>` in the root layout avoids the class-swap hydration warning.
- The `viewport.themeColor` in `layout.tsx` sets the browser chrome color per scheme
  (`#faf8f4` light, `#2b231c` dark).

**Toggle UI:** [`components/mode-toggle.tsx`](../../components/mode-toggle.tsx) flips between
`light`/`dark` via `useTheme()`. It guards against a hydration mismatch with
`React.useSyncExternalStore` (server snapshot → `false`), keeping the icon neutral (`Moon`)
until mounted, then showing `Sun` in dark mode.

```
                ┌────────────────── next-themes ──────────────────┐
 user click ──▶ │ useTheme().setTheme("dark"|"light")             │
 OS preference ▶│ (enableSystem) → resolvedTheme                  │
                └──────────────┬──────────────────────────────────┘
                               │ attribute="class"
                               ▼
                   <html class="… dark …">  ← activates .dark { OKLCH overrides }
                               ▼
                   every token (bg-gold, shadow-e2, …) re-resolves
```

---

## Quick reference — house defaults

- **Surface:** `rounded-2xl bg-card ring-1 ring-foreground/5` (+ `.hover-lift` if interactive).
- **Heading:** `font-serif` (auto on `h1–h4`); section header = `.eyebrow` + `.section-title`.
- **Brand color:** `text-primary`/`bg-gold` for actions, `text-wine`/`bg-wine` for accent.
- **Glow background:** `.cellar-glow` behind hero/feature blocks; `shadow-glow` on the CTA.
- **Spacing:** wrap page sections in `container-px`.
- **Direction:** logical props only (`ps/pe/ms/me/start/end/border-s/-e`).
- **Persian text:** never `uppercase` or `tracking-*`; format numbers/prices/dates with
  `faNum` / `formatPrice` / `faDate`.
- **Class merging:** always `cn(...)`; variants via `cva`.
