import type { AdminUser } from "@/features/customers/types";
import type { CustomerEditFormValues } from "@/features/customers/validations";
import { ROLE_LABELS } from "@/lib/rbac/roles";

export function IdentitySummary({
  user,
  watchedRole,
}: {
  user: AdminUser;
  watchedRole: CustomerEditFormValues["role"];
}) {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="border-hairline rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/[0.04]">
      <span
        className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 font-serif text-2xl text-primary"
        aria-hidden
      >
        {(fullName || user.email).trim().charAt(0).toUpperCase()}
      </span>
      <p className="mt-3 font-medium">{fullName || "بدون نام"}</p>
      <p className="text-xs text-muted-foreground" dir="ltr">
        {user.email}
      </p>
      <p className="mt-3 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
        {ROLE_LABELS[watchedRole] ?? ROLE_LABELS[user.role]}
      </p>
    </div>
  );
}
