"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function HeaderChrome({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        scrolled
          ? "border-border/60 bg-background/85 shadow-e1"
          : "border-transparent bg-background/60",
      )}
    >
      {children}
    </header>
  );
}
