import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { WalletView } from "@/features/account/wallet/components/wallet-view";

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
  );
}
