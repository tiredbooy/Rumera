import type { AdminUserRole } from "../types";
import { ROLE_LABELS } from "@/lib/rbac/roles";

export function UserRoleBadge({ role }: { role: AdminUserRole }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {ROLE_LABELS[role]}
    </span>
  );
}
