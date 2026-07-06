import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { ReviewsView } from "@/features/account/reviews/components/reviews-view";

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
  );
}
