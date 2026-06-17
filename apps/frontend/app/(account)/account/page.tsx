import { getSession } from "@/lib/auth/session"
import { AccountPageHeader } from "@/components/account/account-page-header"
import { AccountOverview } from "@/components/account/account-overview"

export default async function AccountOverviewPage() {
  const session = await getSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "دوست عزیز"

  return (
    <>
      <AccountPageHeader
        eyebrow="خوش آمدید"
        title={`سلام، ${firstName}`}
        description="خلاصه‌ای از حساب، سفارش‌ها و کیف پول شما."
      />
      <AccountOverview />
    </>
  )
}
