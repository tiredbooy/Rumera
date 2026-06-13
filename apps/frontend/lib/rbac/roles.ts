/**
 * Roles → permissions mapping.
 *
 * The backend JWT currently carries a single `role` string (see
 * `apps/backend/docs/authentication.md`). Until the token also carries the
 * resolved permission set, the frontend derives permissions from the role using
 * the map below — which mirrors the backend `roles`/`permissions` tables.
 *
 * When the API starts embedding permissions in the token, read them straight
 * from the session in `lib/auth/auth.ts` and this map becomes the fallback.
 */
import { PERMISSIONS, type Permission } from "./permissions"

/** Roles recognised by the backend (`customer` is the default self-registration). */
export type Role = "customer" | "support" | "manager" | "admin" | "vendor"

const ALL: Permission[] = Object.values(PERMISSIONS)

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Customers have no admin-surface permissions; their access is scoped to
  // their own data via the customer API tier, not the permission catalogue.
  customer: [],
  vendor: [],
  // Front-line support: read orders/customers, moderate reviews.
  support: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
  ],
  // Store manager: run the catalogue, inventory and orders day-to-day.
  manager: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_WRITE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_WRITE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_WRITE,
    PERMISSIONS.ORDERS_REFUND,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.REVIEWS_READ,
    PERMISSIONS.REVIEWS_MODERATE,
    PERMISSIONS.RECIPES_READ,
    PERMISSIONS.RECIPES_WRITE,
    PERMISSIONS.ANALYTICS_READ,
  ],
  // Full platform access.
  admin: ALL,
}

/** Persian labels for roles (used on the customers/roles admin screens). */
export const ROLE_LABELS: Record<Role, string> = {
  customer: "مشتری",
  vendor: "فروشنده",
  support: "پشتیبانی",
  manager: "مدیر فروشگاه",
  admin: "مدیر کل",
}

/** Staff roles get access to the `/admin` surface. */
const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>(["support", "manager", "admin"])

export function isStaff(role: Role | string | undefined | null): boolean {
  return !!role && STAFF_ROLES.has(role as Role)
}

export function permissionsForRole(role: Role | string | undefined | null): Permission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role as Role] ?? []
}
