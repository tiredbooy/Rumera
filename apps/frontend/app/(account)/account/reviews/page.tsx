import { MessageSquare } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default function AccountReviewsPage() {
  return (
    <>
      <PageHeader title="دیدگاه‌های من" description="نظرهایی که برای محصولات ثبت کرده‌اید." />
      <Placeholder
        icon={MessageSquare}
        title="هنوز دیدگاهی ثبت نکرده‌اید"
        description="با اتصال به /api/v1/reviews دیدگاه‌های شما اینجا نمایش و قابل ویرایش می‌شوند."
      />
    </>
  )
}
