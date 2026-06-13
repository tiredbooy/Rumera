/**
 * Checkout is authenticated and per-user: guard with `requireUser`, render
 * dynamically, and keep it out of the index.
 */
import type { Metadata } from "next"

import { requireUser } from "@/lib/auth/session"
import { noindexMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = noindexMetadata("تسویه حساب")

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser("/checkout")
  return <>{children}</>
}
