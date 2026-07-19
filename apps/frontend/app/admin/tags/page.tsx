import { requireTagAdmin } from "@/features/admin/tags/admin-only";
import { TagsBoard } from "@/features/admin/tags/components/tags-board";

export default async function AdminTagsPage() {
  await requireTagAdmin();
  return <TagsBoard />;
}
