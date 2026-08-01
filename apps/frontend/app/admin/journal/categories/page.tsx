import { JournalCategoriesBoard } from "@/features/admin/journal/components/journal-categories-board";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminJournalCategoriesPage() {
  const session = await requirePermission(
    PERMISSIONS.JOURNAL_READ,
    "/admin/journal/categories",
  );
  return (
    <JournalCategoriesBoard
      canWrite={can(session, PERMISSIONS.JOURNAL_WRITE)}
    />
  );
}
