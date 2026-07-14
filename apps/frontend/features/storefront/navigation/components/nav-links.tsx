import Link from "next/link";

import { Button } from "@/components/ui/button";
import { primaryNavigationItems } from "../config";

export function NavLinks() {
  return primaryNavigationItems.map((item) => (
    <Button
      key={item.href}
      variant="ghost"
      size="sm"
      asChild
      className="min-h-11"
    >
      <Link href={item.href}>{item.label}</Link>
    </Button>
  ));
}
