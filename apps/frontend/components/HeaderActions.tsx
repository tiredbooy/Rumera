import Link from "next/link"
import { Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { CartButton } from "@/components/cart/cart-button"

export function HeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button variant="ghost" size="icon" aria-label="جستجو" asChild className="lg:hidden">
        <Link href="/search">
          <Search />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="حساب کاربری"
        asChild
        className="hidden sm:inline-flex"
      >
        <Link href="/account">
          <User />
        </Link>
      </Button>
      <ModeToggle />
      {/* Divider before the cart so it reads as the primary action */}
      <span className="mx-1 hidden h-6 w-px bg-border/70 sm:block" />
      <CartButton />
    </div>
  )
}