import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";

/** Storefront header brand — full mark + wordmark, priority LCP-safe. */
export function HeaderLogo() {
  return (
    <RumeraBrandMark
      variant="full"
      size="md"
      href="/"
      priority
      className="transition-[opacity,transform] duration-300 group-hover/brand:opacity-95"
    />
  );
}
