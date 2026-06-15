import { Check, ShieldCheck, Users } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/rbac/permissions"
import { ROLE_PERMISSIONS, ROLE_LABELS, type Role } from "@/lib/rbac/roles"
import { faNum } from "@/lib/products"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"

// Staff roles shown as columns (customers/vendors have no admin permissions).
const STAFF_ROLES: Role[] = ["support", "manager", "admin"]
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[]

// Representative team sizes until GET /api/v1/admin/users?role= is wired.
const MEMBER_COUNT: Record<Role, number> = {
  customer: 0,
  vendor: 0,
  support: 3,
  manager: 2,
  admin: 1,
}

const ROLE_DESC: Record<Role, string> = {
  customer: "",
  vendor: "",
  support: "پاسخ‌گویی، مشاهدهٔ سفارش‌ها و بازبینی دیدگاه‌ها.",
  manager: "مدیریت کاتالوگ، موجودی و سفارش‌ها به‌صورت روزانه.",
  admin: "دسترسی کامل به همهٔ بخش‌های پلتفرم.",
}

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE)

  return (
    <>
      <PageHeader
        title="نقش‌ها و دسترسی‌ها"
        description="ماتریس دسترسی هر نقش. منبع: lib/rbac — هم‌راستا با جدول‌های roles/permissions بک‌اند."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {STAFF_ROLES.map((role) => (
          <div
            key={role}
            className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-4.5" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" /> {faNum(MEMBER_COUNT[role])} عضو
              </span>
            </div>
            <p className="mt-3 font-serif text-xl">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ROLE_DESC[role]}</p>
            <p className="mt-3 text-sm">
              <span className="font-medium">{faNum(ROLE_PERMISSIONS[role].length)}</span>
              <span className="text-muted-foreground"> از {faNum(ALL_PERMISSIONS.length)} دسترسی</span>
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-serif text-2xl">ماتریس دسترسی</h2>
      <div className="border-hairline overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-start">دسترسی</TableHead>
              {STAFF_ROLES.map((role) => (
                <TableHead key={role} className="text-center">
                  {ROLE_LABELS[role]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PERMISSIONS.map((permission) => (
              <TableRow key={permission}>
                <TableCell>
                  <span className="font-medium">{PERMISSION_LABELS[permission]}</span>
                  <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                    {permission}
                  </span>
                </TableCell>
                {STAFF_ROLES.map((role) => {
                  const granted = ROLE_PERMISSIONS[role].includes(permission)
                  return (
                    <TableCell key={role} className="text-center">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full",
                          granted
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground/40"
                        )}
                      >
                        {granted ? <Check className="size-3.5" /> : "—"}
                      </span>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
