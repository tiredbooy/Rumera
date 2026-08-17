import { notFound } from "next/navigation";

import { JournalEditView } from "@/features/admin/journal/components/journal-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditJournalPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();
  const session = await requirePermission(
    PERMISSIONS.JOURNAL_READ,
    `/admin/journal/${id}`,
  );
  return (
    <JournalEditView
      id={id}
      canWrite={can(session, PERMISSIONS.JOURNAL_WRITE)}
    />
  );
}
