import type { AdminUserRole } from "../types";

const USER_ROLE_LABELS: Record<AdminUserRole, string> = {
  customer: "مشتری",
  vendor: "فروشنده",
  admin: "مدیر کل",
};

export function UserRoleBadge({ role }: { role: AdminUserRole }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {USER_ROLE_LABELS[role]}
    </span>
  );
}
