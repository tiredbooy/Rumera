import Link from "next/link";
import { Search, User } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/features/cart/components/cart-button";

export function HeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label="رفتن به جستجو"
        asChild
        className="size-11 lg:hidden"
      >
        <Link href="/search">
          <Search />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="حساب کاربری"
        asChild
        className="hidden size-11 sm:inline-flex"
      >
        <Link href="/account">
          <User />
        </Link>
      </Button>
      <ModeToggle />
      <span aria-hidden className="mx-1 hidden h-6 w-px bg-border/70 sm:block" />
      <CartButton />
    </div>
  );
}
