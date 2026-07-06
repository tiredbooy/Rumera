/**
 * Customer dashboard shell. Server-guarded by `requireUser` (redirects to
 * /login when signed out) and `noindex`. Rendered dynamically — every page here
 * is per-user and must never be statically cached.
 */
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/rbac/roles";
import { AccountShell } from "@/features/account/account/components/account-shell";
import { noindexMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata: Metadata = noindexMetadata("حساب کاربری");

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <AccountShell
      user={{
        name: session.user.name,
        email: session.user.email,
        roleLabel: ROLE_LABELS[session.role] ?? "مشتری",
      }}
    >
      {children}
    </AccountShell>
  );
}
