/**
 * Admin console shell. `requireStaff` admits panel roles (`admin` superuser
 * and capability-gated `staff`). Signed-out users go to /login and other roles
 * to /forbidden. Sidebar items filter by live server capabilities.
 *
 * `force-dynamic` because everything here is authenticated, per-user, live data.
 */
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

import { requireStaff } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/rbac/roles";
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";
import {
  loadAdminWorkCounts,
  navBadgesFromWorkCounts,
} from "@/features/dashboard/work-counts";
import { noindexMetadata } from "@/lib/seo/metadata";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const dynamic = "force-dynamic";
export const metadata: Metadata = noindexMetadata("پنل مدیریت");

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  const navBadges = navBadgesFromWorkCounts(
    await loadAdminWorkCounts(session.permissions),
  );

  return (
    <div className={geistMono.variable}>
      <DashboardShell
        variant="admin"
        permissions={session.permissions}
        navBadges={navBadges}
        user={{
          name: session.user.name,
          email: session.user.email,
          roleLabel: ROLE_LABELS[session.role] ?? session.role,
        }}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
