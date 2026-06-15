import { getSession } from "@/lib/auth/session"
import { PageHeader } from "@/components/dashboard/page-header"
import { AccountOverview } from "@/components/account/account-overview"

export default async function AccountOverviewPage() {
  const session = await getSession()
  const firstName = session?.user?.name?.split(" ")[0] ?? "دوست عزیز"

  return (
    <>
      <PageHeader
        title={`سلام، ${firstName}`}
        description="خلاصه‌ای از حساب، سفارش‌ها و کیف پول شما."
      />
      <AccountOverview />
    </>
  )
}
