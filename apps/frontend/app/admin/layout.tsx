/**
 * Staff console shell. Server-guarded by `requireStaff` (non-staff are bounced
 * to /admin/403, signed-out users to /login) and `noindex`. The sidebar is
 * permission-filtered, so a `support` user and an `admin` see different menus
 * from the same layout.
 *
 * `force-dynamic` because everything here is authenticated, per-user, live data.
 */
import type { Metadata } from "next"

import { requireStaff } from "@/lib/auth/session"
import { ROLE_LABELS } from "@/lib/rbac/roles"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { noindexMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = noindexMetadata("پنل مدیریت")

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireStaff()

  return (
    <DashboardShell
      variant="admin"
      permissions={session.permissions}
      user={{
        name: session.user.name,
        email: session.user.email,
        roleLabel: ROLE_LABELS[session.role] ?? session.role,
      }}
    >
      {children}
    </DashboardShell>
  )
}
