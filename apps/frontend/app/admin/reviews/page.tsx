import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { PageHeader } from "@/components/dashboard/page-header"
import { ReviewsQueue } from "@/components/admin/reviews-queue"

export default async function AdminReviewsPage() {
  const session = await requirePermission(PERMISSIONS.REVIEWS_READ)
  const canModerate = can(session, PERMISSIONS.REVIEWS_MODERATE)

  return (
    <>
      <PageHeader title="دیدگاه‌ها" description="بازبینی و تأیید نظرهای مشتریان." />
      <ReviewsQueue canModerate={canModerate} />
    </>
  )
}
