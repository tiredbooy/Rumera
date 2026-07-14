import Link from "next/link";
import { Wine } from "lucide-react";

export function HeaderLogo() {
  return (
    <Link
      href="/"
      aria-label="رومرا — خانه"
      className="group/brand flex min-h-11 shrink-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/15 transition-all duration-300 group-hover/brand:bg-primary/25 group-hover/brand:ring-primary/30 motion-reduce:transition-none">
        <Wine className="size-4.5 transition-transform duration-500 group-hover/brand:-rotate-12 motion-reduce:transition-none" />
      </span>
      <span className="font-serif text-3xl leading-none">
        <span className="text-foil">رومرا</span>
      </span>
    </Link>
  );
}
