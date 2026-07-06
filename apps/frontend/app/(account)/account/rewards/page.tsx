import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { RewardsView } from "@/components/loyalty/rewards-view";
import { ReferralCard } from "@/features/referral/components/referral-card";

export default function AccountRewardsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="باشگاه"
        title="باشگاه مشتریان"
        description="با هر خرید امتیاز بگیرید و آن را به اعتبار کیف پول تبدیل کنید."
      />
      <RewardsView />
      <div className="mt-6">
        <ReferralCard />
      </div>
    </>
  );
}
