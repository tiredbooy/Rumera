import { PageHeader } from "@/components/dashboard/page-header"
import { ReviewsView } from "@/components/account/reviews-view"

export default function AccountReviewsPage() {
  return (
    <>
      <PageHeader title="دیدگاه‌های من" description="نظرهایی که برای محصولات ثبت کرده‌اید." />
      <ReviewsView />
    </>
  )
}
