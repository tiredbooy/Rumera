import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { OrdersList } from "@/features/account/orders/components/OrdersList";

export default function AccountOrdersPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="سفارش‌ها"
        title="سفارش‌های من"
        description="تاریخچهٔ سفارش‌ها و وضعیت ارسال."
      />
      <OrdersList />
    </>
  );
}
