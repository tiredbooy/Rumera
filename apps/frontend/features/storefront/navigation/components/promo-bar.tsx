import { Sparkles } from "lucide-react";

import { storefrontAnnouncement } from "../config";

export function PromoBar() {
  return (
    <div className="group/promo relative overflow-hidden bg-foreground text-background">
      <div className="container-px mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 text-xs font-medium">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">{storefrontAnnouncement}</span>
      </div>
      <span
        aria-hidden
        className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-1000 group-hover/promo:translate-x-full group-hover/promo:opacity-100 motion-reduce:transition-none"
      />
    </div>
  );
}
