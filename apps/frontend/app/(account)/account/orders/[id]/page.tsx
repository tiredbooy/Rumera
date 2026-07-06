import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { OrderDetail } from "@/components/account/order-detail";

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AccountPageHeader
        eyebrow="جزئیات سفارش"
        title={`سفارش #${faNum(Number(id) || 0)}`}
        description="جزئیات اقلام، پرداخت و وضعیت ارسال."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/account/orders">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <OrderDetail id={id} />
    </>
  );
}
