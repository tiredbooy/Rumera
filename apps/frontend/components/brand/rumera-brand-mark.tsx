import Image from "next/image";
import Link from "next/link";

import {
  brandCopy,
  brandMarkBox,
  brandMarks,
  type BrandMarkSize,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

export type RumeraBrandMarkProps = {
  /**
   * - `full` — mark + Persian wordmark (default chrome)
   * - `mark` — logo artwork only
   * - `wordmark` — typographic wordmark only
   */
  variant?: "full" | "mark" | "wordmark";
  /**
   * Surface the mark sits on:
   * - `auto` — light asset in light mode, dark-field badge in dark mode
   * - `on-light` / `on-dark` — force a pair (auth cellar glow uses `on-dark`)
   */
  tone?: "auto" | "on-light" | "on-dark";
  size?: BrandMarkSize;
  /** When set, wraps in a link. Pass `null` for a non-interactive mark. */
  href?: string | null;
  /**
   * When true (or when adjacent visible text already names the brand), the
   * image is decorative (`alt=""`). Prefer `false` when the mark is alone.
   */
  decorative?: boolean;
  /** Eager-load above-the-fold header marks. */
  priority?: boolean;
  className?: string;
  /** Optional subtitle under the wordmark (e.g. «پنل مدیریت»). */
  caption?: string;
  /** Override link/button accessible name when not decorative. */
  "aria-label"?: string;
};

/**
 * Single reusable Rumera brand mark for storefront, auth, admin, and account.
 *
 * Mobile-first: touch-safe hit area (≥44px) when linked; fixed aspect box to
 * avoid CLS; no stretch — only contain-fit. Artwork is never redrawn.
 */
export function RumeraBrandMark({
  variant = "full",
  tone = "auto",
  size = "md",
  href = "/",
  decorative = false,
  priority = false,
  className,
  caption,
  "aria-label": ariaLabel,
}: RumeraBrandMarkProps) {
  const box = brandMarkBox(size);
  const showMark = variant === "full" || variant === "mark";
  const showWord = variant === "full" || variant === "wordmark";
  const alt = decorative ? "" : brandCopy.alt;
  const label =
    ariaLabel ??
    (href === "/" || href === undefined
      ? brandCopy.homeAriaLabel
      : brandCopy.wordmarkFa);

  const mark = showMark ? (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        // Soft plate so the mark reads on both foil and plain backgrounds.
        variant === "full" &&
          "rounded-xl bg-primary/10 ring-1 ring-primary/15",
      )}
      style={{ width: box.width, height: box.height }}
    >
      {/* Light-surface monogram */}
      {/* SVG marks use unoptimized next/image so the pipeline never re-encodes
          vector artwork (keeps transparency + crisp edges at all DPRs). */}
      <Image
        src={brandMarks.onLight.svg.src}
        alt={alt}
        width={box.width}
        height={box.height}
        priority={priority}
        unoptimized
        className={cn(
          "size-full object-contain p-1",
          tone === "auto" && "dark:hidden",
          tone === "on-dark" && "hidden",
          tone === "on-light" && "block",
        )}
      />
      {/* Dark-field badge */}
      <Image
        src={brandMarks.onDark.svg.src}
        alt={alt}
        width={box.width}
        height={box.height}
        priority={priority}
        unoptimized
        className={cn(
          "size-full object-contain",
          tone === "auto" && "hidden dark:block",
          tone === "on-dark" && "block",
          tone === "on-light" && "hidden",
        )}
      />
    </span>
  ) : null;

  const word = showWord ? (
    <span className="min-w-0 leading-tight">
      <span
        className={cn(
          "font-serif leading-none text-foil",
          size === "xs" && "text-xl",
          size === "sm" && "text-2xl",
          size === "md" && "text-3xl",
          size === "lg" && "text-3xl sm:text-4xl",
          size === "xl" && "text-4xl sm:text-5xl",
        )}
      >
        {brandCopy.wordmarkFa}
      </span>
      {caption ? (
        <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground sm:text-xs">
          {caption}
        </span>
      ) : null}
    </span>
  ) : null;

  const body = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 sm:gap-2.5",
        className,
      )}
    >
      {mark}
      {word}
    </span>
  );

  if (href == null) {
    return (
      <span
        className="inline-flex"
        {...(decorative
          ? { "aria-hidden": true as const }
          : { role: "img" as const, "aria-label": label })}
      >
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      tabIndex={decorative ? -1 : undefined}
      className={cn(
        "group/brand inline-flex min-h-11 min-w-11 items-center rounded-xl outline-none",
        "transition-opacity hover:opacity-90",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {body}
    </Link>
  );
}
