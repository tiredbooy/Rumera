import { PageHeader } from "@/components/dashboard/page-header"
import { RewardsView } from "@/components/loyalty/rewards-view"
import { ReferralCard } from "@/components/referral/referral-card"

export default function AccountRewardsPage() {
  return (
    <>
      <PageHeader
        title="باشگاه مشتریان"
        description="با هر خرید امتیاز بگیرید و آن را به اعتبار کیف پول تبدیل کنید."
      />
      <RewardsView />
      <div className="mt-6">
        <ReferralCard />
      </div>
    </>
  )
}
