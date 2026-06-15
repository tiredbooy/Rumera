"use client"

import { formatPrice, faNum } from "@/lib/products"
import { adminCustomers, TIER_LABELS, type AdminCustomer } from "@/lib/admin/data"
import { cn } from "@/lib/utils"
import { CustomerBadge } from "@/components/admin/status-badge"
import { DataTable, type Column, type Filter } from "@/components/admin/data-table"

const TIER_CLS: Record<AdminCustomer["tier"], string> = {
  bronze: "bg-amber-700/10 text-amber-700 dark:text-amber-500",
  silver: "bg-slate-400/15 text-slate-500 dark:text-slate-300",
  gold: "bg-gold/15 text-gold",
  platinum: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

function TierPill({ tier }: { tier: AdminCustomer["tier"] }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TIER_CLS[tier])}>
      {TIER_LABELS[tier]}
    </span>
  )
}

export function CustomersTable() {
  const columns: Column<AdminCustomer>[] = [
    {
      id: "name",
      header: "مشتری",
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary">
            {c.name.trim().charAt(0)}
          </span>
          <div className="leading-tight">
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">{c.email}</p>
          </div>
        </div>
      ),
    },
    { id: "phone", header: "تلفن", cell: (c) => <span className="text-muted-foreground tabular-nums" dir="ltr">{c.phone}</span> },
    { id: "orders", header: "سفارش‌ها", sortValue: (c) => c.ordersCount, cell: (c) => <span className="tabular-nums">{faNum(c.ordersCount)}</span> },
    { id: "ltv", header: "ارزش کل", sortValue: (c) => c.ltv, cell: (c) => <span className="font-medium">{formatPrice(c.ltv)}</span> },
    { id: "tier", header: "باشگاه", sortValue: (c) => c.tier, cell: (c) => <TierPill tier={c.tier} /> },
    { id: "status", header: "وضعیت", sortValue: (c) => c.status, cell: (c) => <CustomerBadge status={c.status} /> },
    { id: "joined", header: "عضویت", sortValue: (c) => c.joined, cell: (c) => <span className="text-muted-foreground" dir="ltr">{c.joined}</span> },
  ]

  const filters: Filter<AdminCustomer>[] = [
    {
      id: "status",
      label: "وضعیت",
      getValue: (c) => c.status,
      options: [
        { value: "active", label: "فعال" },
        { value: "banned", label: "مسدود" },
      ],
    },
    {
      id: "tier",
      label: "باشگاه",
      getValue: (c) => c.tier,
      options: (Object.keys(TIER_LABELS) as AdminCustomer["tier"][]).map((t) => ({
        value: t,
        label: TIER_LABELS[t],
      })),
    },
  ]

  return (
    <DataTable
      rows={adminCustomers}
      columns={columns}
      getRowKey={(c) => c.id}
      searchText={(c) => `${c.name} ${c.email} ${c.phone}`}
      searchPlaceholder="جستجوی نام، ایمیل یا تلفن…"
      filters={filters}
      rowHref={(c) => `/admin/customers/${c.id}`}
      pageSize={10}
    />
  )
}
