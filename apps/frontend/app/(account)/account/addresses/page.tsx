import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { AddressesView } from "@/features/account/addresses/components/addresses-view";

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
  );
}
