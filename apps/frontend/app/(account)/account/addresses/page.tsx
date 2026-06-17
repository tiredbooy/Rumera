import { AccountPageHeader } from "@/components/account/account-page-header"
import { AddressesView } from "@/components/account/addresses-view"

export default function AccountAddressesPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="نشانی‌ها"
        title="آدرس‌ها"
        description="آدرس‌های تحویل خود را مدیریت کنید."
      />
      <AddressesView />
    </>
  )
}
