"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminPage } from "@/features/dashboard/components/admin-page";

import { GiftCardList } from "./gift-card-list";

export function GiftCardsBoard() {
  return (
    <AdminPage
      title="کارت‌های هدیه"
      description="دفتر کدهای صادرشده. برای صدور دستهٔ تازه از «صدور کارت» استفاده کنید. ابطال فقط کارت فعال را غیرفعال می‌کند و بازپرداخت نیست."
      action={
        <Button size="sm" asChild>
          <Link href="/admin/gift-cards/new">
            <Plus className="size-4" /> صدور کارت
          </Link>
        </Button>
      }
    >
      <GiftCardList />
    </AdminPage>
  );
}
