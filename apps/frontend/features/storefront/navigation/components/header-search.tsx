"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface HeaderSearchProps {
  variant?: "inline" | "drawer";
  autoFocus?: boolean;
  onSubmitNavigate?: () => void;
}

export function HeaderSearch({
  variant = "inline",
  autoFocus = false,
  onSubmitNavigate,
}: HeaderSearchProps) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDrawer = variant === "drawer";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    onSubmitNavigate?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="جستجوی فروشگاه"
      className={cn(
        "relative w-full",
        !isDrawer && "group/search max-w-md",
      )}
    >
      <button
        type="submit"
        aria-label="اجرای جستجو"
        className="absolute inset-y-0 start-0 flex w-11 cursor-pointer items-center justify-center rounded-s-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Search className="size-4" />
      </button>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="جستجوی محصول، برند یا دسته…"
        aria-label="عبارت جستجو"
        autoComplete="off"
        autoFocus={autoFocus}
        className={cn(
          "h-11 w-full rounded-full border border-border/70 bg-secondary/50 ps-11 pe-11 text-sm outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
          !isDrawer && "focus:bg-background",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="پاک کردن عبارت جستجو"
          className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
