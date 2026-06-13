import { PageHeader } from "@/components/dashboard/page-header"
import { OrdersList } from "@/components/account/orders-list"

export default function AccountOrdersPage() {
  return (
    <>
      <PageHeader title="سفارش‌های من" description="تاریخچهٔ سفارش‌ها و وضعیت ارسال." />
      <OrdersList />
    </>
  )
}
