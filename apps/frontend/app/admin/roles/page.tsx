import { Check } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/rbac/permissions"
import { ROLE_PERMISSIONS, ROLE_LABELS, type Role } from "@/lib/rbac/roles"
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

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE)

  return (
    <>
      <PageHeader
        title="نقش‌ها و دسترسی‌ها"
        description="ماتریس دسترسی هر نقش. منبع: lib/rbac — هم‌راستا با جدول‌های roles/permissions بک‌اند."
      />

      <div className="border-hairline overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow>
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
