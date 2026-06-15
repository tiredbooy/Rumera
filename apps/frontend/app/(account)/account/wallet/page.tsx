import { PageHeader } from "@/components/dashboard/page-header"
import { WalletView } from "@/components/account/wallet-view"

export default function AccountWalletPage() {
  return (
    <>
      <PageHeader title="کیف پول" description="موجودی و تراکنش‌های کیف پول رومرا." />
      <WalletView />
    </>
  )
}
