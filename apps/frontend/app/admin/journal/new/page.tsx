import { JournalCreateView } from "@/features/admin/journal/components/journal-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewJournalPostPage() {
  await requirePermission(PERMISSIONS.JOURNAL_WRITE, "/admin/journal/new");
  return <JournalCreateView />;
}
