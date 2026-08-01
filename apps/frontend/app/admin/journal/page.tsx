import { JournalBoard } from "@/features/admin/journal/components/journal-board";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/auth/session";

export default async function AdminJournalPage() {
  const session = await requirePermission(
    PERMISSIONS.JOURNAL_READ,
    "/admin/journal",
  );
  return <JournalBoard canWrite={can(session, PERMISSIONS.JOURNAL_WRITE)} />;
}
