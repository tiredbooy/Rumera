import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { ReviewsQueue } from "@/features/admin/reviews/components/ReviewsQueue";

export default async function AdminReviewsPage() {
  const session = await requirePermission(PERMISSIONS.REVIEWS_READ);
  // The queue owns the page shell: it holds the status filter and the pager.
  return <ReviewsQueue canModerate={can(session, PERMISSIONS.REVIEWS_MODERATE)} />;
}
