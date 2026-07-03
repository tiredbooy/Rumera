import Link from "next/link"
import { BookOpen, Info, UtensilsCrossed, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const staticNavItems: NavItem[] = [
  { label: "دستورها", href: "/recipes", icon: UtensilsCrossed },
  { label: "ژورنال", href: "/journal", icon: BookOpen },
  { label: "دربارهٔ ما", href: "/about", icon: Info },
]

/** Desktop nav pills. Mobile reuses `staticNavItems` directly with its own markup. */
export function NavLinks() {
  return (
    <>
      {staticNavItems.map((item) => (
        <Button key={item.href} variant="ghost" size="sm" asChild>
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </>
  )
}