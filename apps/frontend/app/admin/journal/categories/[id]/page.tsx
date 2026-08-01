import { notFound } from "next/navigation";

import { JournalCategoryEditView } from "@/features/admin/journal/components/journal-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditJournalCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();
  await requirePermission(
    PERMISSIONS.JOURNAL_WRITE,
    `/admin/journal/categories/${id}`,
  );
  return <JournalCategoryEditView id={id} />;
}
