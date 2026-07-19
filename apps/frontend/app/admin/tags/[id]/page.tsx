import { notFound } from "next/navigation";

import { requireTagAdmin } from "@/features/admin/tags/admin-only";
import { TagEditView } from "@/features/admin/tags/components/tag-editor-view";

export default async function AdminEditTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();
  await requireTagAdmin(`/admin/tags/${id}`);
  return <TagEditView id={id} />;
}
