"use client";

import { AdminFilterBar } from "@/features/dashboard/components/admin-page";
import { FilterSelect } from "@/features/dashboard/components/admin-filter-controls";
import { LOYALTY_REASON_FA } from "@/features/loyalty/reasons";

const REASON_OPTIONS = [
  { value: "", label: "همهٔ علت‌ها" },
  ...Object.entries(LOYALTY_REASON_FA).map(([value, label]) => ({
    value,
    label,
  })),
];

export function LoyaltyLedgerFilterBar({
  userID,
  reason,
}: {
  userID: string;
  reason?: string;
}) {
  return (
    <AdminFilterBar
      id="loyalty-ledger-filter-title"
      title="فیلتر دفتر کل"
      hasFilters={Boolean(reason)}
      resetHref={`/admin/loyalty/${userID}`}
      className="mb-4"
      gridClassName="max-w-xs"
    >
      <FilterSelect
        id="loyalty-ledger-reason"
        label="علت"
        param="reason"
        value={reason ?? ""}
        options={REASON_OPTIONS}
      />
    </AdminFilterBar>
  );
}
