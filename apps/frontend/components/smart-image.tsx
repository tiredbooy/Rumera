"use client";

import * as React from "react";
import Image from "next/image";

import {
  isMediaPipelinePath,
  resolveMediaUrl,
} from "@/lib/media/resolve-media-url";
import { cn } from "@/lib/utils";

/**
 * SmartImage — `next/image` with a graceful, on-brand fallback.
 *
 * Resolves backend-relative `/media/...` values against the configured media
 * origin so admin previews work when the API is on a different host/port than
 * the Next app. Static placeholders under `/images/...` stay same-origin.
 *
 * Always renders with `fill`, so the parent must be `relative` and sized.
 */
export function SmartImage({
  src,
  alt,
  sizes,
  priority,
  className,
  fallbackClassName,
  monogram = "ر",
  label,
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
  /** Single glyph shown in the fallback (defaults to the Rumera wordmark initial). */
  monogram?: string;
  /** Optional caption under the monogram in the fallback. */
  label?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const resolved = resolveMediaUrl(src);
  const showFallback = !resolved || failed;

  // Reset error state when the resolved source changes (e.g. after upload).
  React.useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2",
          "bg-gradient-to-br from-accent/60 via-card to-secondary",
          fallbackClassName,
        )}
        role="img"
        aria-label={alt}
      >
        <span
          aria-hidden
          className="cellar-glow flex size-16 items-center justify-center rounded-2xl font-serif text-3xl text-foil ring-1 ring-foreground/10"
        >
          {monogram}
        </span>
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  // Cross-origin media pipeline URLs (and any already-absolute http assets) use
  // a plain <img> so local http:// API origins work without next/image remote
  // pattern gymnastics. Site-relative static files keep next/image optimization.
  if (
    isMediaPipelinePath(src) ||
    /^https?:\/\//i.test(resolved) ||
    resolved.startsWith("blob:") ||
    resolved.startsWith("data:")
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- cross-origin /media and blob previews.
      <img
        src={resolved}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
