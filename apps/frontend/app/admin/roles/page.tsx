import { Check, ShieldCheck, Users } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/rbac/permissions";
import { ROLE_PERMISSIONS, ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/features/dashboard/components/page-header";

// Staff roles shown as columns (customers/vendors have no admin permissions).
const STAFF_ROLES: Role[] = ["support", "manager", "admin"];
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

// Representative team sizes until GET /api/v1/admin/users?role= is wired.
const MEMBER_COUNT: Record<Role, number> = {
  customer: 0,
  vendor: 0,
  support: 3,
  manager: 2,
  admin: 1,
};

const ROLE_DESC: Record<Role, string> = {
  customer: "",
  vendor: "",
  support: "پاسخ‌گویی، مشاهدهٔ سفارش‌ها و بازبینی دیدگاه‌ها.",
  manager: "مدیریت کاتالوگ، موجودی و سفارش‌ها به‌صورت روزانه.",
  admin: "دسترسی کامل به همهٔ بخش‌های پلتفرم.",
};

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);

  return (
    <>
      <PageHeader
        title="نقش‌ها و دسترسی‌ها"
        description="ماتریس دسترسی هر نقش. منبع: lib/rbac — هم‌راستا با جدول‌های roles/permissions بک‌اند."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {STAFF_ROLES.map((role) => {
          const pct = Math.round(
            (ROLE_PERMISSIONS[role].length / ALL_PERMISSIONS.length) * 100,
          );
          return (
            <div
              key={role}
              className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:ring-primary/15"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <ShieldCheck className="size-4.5" />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground">
                  <Users className="size-3.5" /> {faNum(MEMBER_COUNT[role])} عضو
                </span>
              </div>
              <p className="mt-3 font-serif text-lg">{ROLE_LABELS[role]}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {ROLE_DESC[role]}
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">
                      {faNum(ROLE_PERMISSIONS[role].length)}
                    </span>{" "}
                    از {faNum(ALL_PERMISSIONS.length)} دسترسی
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    ٪{faNum(pct)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 font-serif text-lg">ماتریس دسترسی</h2>
      <div className="border-hairline overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                دسترسی
              </TableHead>
              {STAFF_ROLES.map((role) => (
                <TableHead
                  key={role}
                  className="h-10 text-center text-xs font-medium text-muted-foreground"
                >
                  {ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PERMISSIONS.map((permission) => (
              <TableRow key={permission} className="border-border/40">
                <TableCell>
                  <span className="font-medium">
                    {PERMISSION_LABELS[permission]}
                  </span>
                  <span
                    className="ms-2 text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {permission}
                  </span>
                </TableCell>
                {STAFF_ROLES.map((role) => {
                  const granted = ROLE_PERMISSIONS[role].includes(permission);
                  return (
                    <TableCell key={role} className="text-center">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full ring-1 ring-inset",
                          granted
                            ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                            : "bg-muted/50 text-muted-foreground/30 ring-border/50",
                        )}
                      >
                        {granted ? <Check className="size-3.5" /> : "—"}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
