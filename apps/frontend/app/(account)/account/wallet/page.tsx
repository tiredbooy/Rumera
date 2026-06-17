import { AccountPageHeader } from "@/components/account/account-page-header"
import { WalletView } from "@/components/account/wallet-view"

export default function AccountWalletPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="اعتبار"
        title="کیف پول"
        description="موجودی و تراکنش‌های کیف پول رومرا."
      />
      <WalletView />
    </>
  )
}
