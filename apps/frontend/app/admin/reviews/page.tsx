import { Star } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AdminReviewsPage() {
  await requirePermission(PERMISSIONS.REVIEWS_READ)
  return (
    <>
      <PageHeader title="دیدگاه‌ها" description="بازبینی و تأیید نظرهای مشتریان." />
      <Placeholder
        icon={Star}
        title="صف بازبینی در انتظار اتصال به سرویس"
        description="GET /api/v1/reviews — دیدگاه‌های در انتظار تأیید اینجا برای بازبینی نمایش داده می‌شوند."
      />
    </>
  )
}
