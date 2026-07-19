import { requireTagAdmin } from "@/features/admin/tags/admin-only";
import { TagCreateView } from "@/features/admin/tags/components/tag-editor-view";

export default async function AdminNewTagPage() {
  await requireTagAdmin("/admin/tags/new");
  return <TagCreateView />;
}
