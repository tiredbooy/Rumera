import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { RewardsView } from "@/features/loyalty/components/rewards-view";
import { ReferralCard } from "@/features/referral/components/referral-card";

export default function AccountRewardsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="باشگاه"
        title="باشگاه مشتریان"
        description="با پرداخت موفق، نظر خرید تأییدشده، تولد و معرفی دوستان امتیاز بگیرید و به اعتبار کیف پول تبدیل کنید."
      />
      <RewardsView />
      <div className="mt-6">
        <ReferralCard />
      </div>
    </>
  );
}
