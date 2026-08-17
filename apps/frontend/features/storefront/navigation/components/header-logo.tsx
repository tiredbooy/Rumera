import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { brandCopy } from "@/lib/brand";

/** Storefront header brand — full mark + wordmark, priority LCP-safe. */
export function HeaderLogo({
  storeName,
  tagline,
}: {
  storeName?: string;
  tagline?: string;
}) {
  const name = storeName?.trim() || brandCopy.wordmarkFa;

  return (
    <RumeraBrandMark
      variant="full"
      size="md"
      href="/"
      priority
      aria-label={`${name} — خانه`}
      caption={tagline}
      className="transition-[opacity,transform] duration-300 group-hover/brand:opacity-95"
    />
  );
}
