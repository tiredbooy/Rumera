import { AccountPageHeader } from "@/components/account/account-page-header"
import { ReviewsView } from "@/components/account/reviews-view"

export default function AccountReviewsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="دیدگاه‌ها"
        title="دیدگاه‌های من"
        description="نظرهایی که برای محصولات ثبت کرده‌اید."
      />
      <ReviewsView />
    </>
  )
}
