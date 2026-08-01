import { JournalCategoryCreateView } from "@/features/admin/journal/components/journal-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewJournalCategoryPage() {
  await requirePermission(
    PERMISSIONS.JOURNAL_WRITE,
    "/admin/journal/categories/new",
  );
  return <JournalCategoryCreateView />;
}
