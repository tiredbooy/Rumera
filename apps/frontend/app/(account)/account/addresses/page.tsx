import { PageHeader } from "@/components/dashboard/page-header"
import { AddressesView } from "@/components/account/addresses-view"

export default function AccountAddressesPage() {
  return (
    <>
      <PageHeader title="آدرس‌ها" description="آدرس‌های تحویل خود را مدیریت کنید." />
      <AddressesView />
    </>
  )
}
