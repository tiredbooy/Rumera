import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Semantic status colour. Orthogonal to `variant` and declared after it,
      // so its classes win the tailwind-merge conflict on bg/text/border while
      // the variant still supplies shape and focus styles. Tokens live in
      // app/globals.css (--success/--warning/--info/--neutral, light + dark).
      tone: {
        success:
          "border-success/25 bg-success/12 text-success focus-visible:ring-success/30 [a]:hover:bg-success/20",
        warning:
          "border-warning/25 bg-warning/12 text-warning focus-visible:ring-warning/30 [a]:hover:bg-warning/20",
        info: "border-info/25 bg-info/12 text-info focus-visible:ring-info/30 [a]:hover:bg-info/20",
        neutral:
          "border-neutral/25 bg-neutral/12 text-neutral focus-visible:ring-neutral/30 [a]:hover:bg-neutral/20",
      },
    },
    compoundVariants: [
      // `outline` keeps its unfilled shape; tone only recolours ink and edge.
      { variant: "outline", tone: "success", class: "bg-transparent border-success/40" },
      { variant: "outline", tone: "warning", class: "bg-transparent border-warning/40" },
      { variant: "outline", tone: "info", class: "bg-transparent border-info/40" },
      { variant: "outline", tone: "neutral", class: "bg-transparent border-neutral/40" },
    ],
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-tone={tone}
      className={cn(badgeVariants({ variant, tone }), className)}
      {...props}
    />
  )
}

/**
 * What a status map hands to <Badge>: `{ tone: "warning" }` for a semantic
 * status, `{ variant: "destructive" }` for the failure look that predates tone.
 */
type BadgeSemantic = Pick<VariantProps<typeof badgeVariants>, "variant" | "tone">

export { Badge, badgeVariants }
export type { BadgeSemantic }
