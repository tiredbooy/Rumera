/**
 * Backend roles mapped to frontend admin capability identifiers.
 *
 * Panel entry: `admin` (superuser) and `staff` (capability-gated). The server
 * `role_capabilities` table is the source of truth for grants; static defaults
 * below mirror the seed matrix so Edge/session bootstrap stays usable offline.
 */
import { PERMISSIONS, type Permission } from "./permissions";

/** Roles recognised by the backend (`customer` is the default self-registration). */
export type Role = "customer" | "vendor" | "admin" | "staff";

const ALL: Permission[] = Object.values(PERMISSIONS);

/** Default staff package — keep aligned with migration seed for staff. */
const STAFF_DEFAULTS: Permission[] = [
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_WRITE,
  PERMISSIONS.TAGS_MANAGE,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_WRITE,
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.ORDERS_WRITE,
  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.COUPONS_MANAGE,
  PERMISSIONS.SHIPPING_MANAGE,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_WRITE,
  PERMISSIONS.REVIEWS_READ,
  PERMISSIONS.REVIEWS_MODERATE,
  PERMISSIONS.RECIPES_READ,
  PERMISSIONS.RECIPES_WRITE,
  PERMISSIONS.JOURNAL_READ,
  PERMISSIONS.JOURNAL_WRITE,
  PERMISSIONS.HERO_MANAGE,
  PERMISSIONS.ANALYTICS_READ,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  vendor: [],
  admin: ALL,
  staff: STAFF_DEFAULTS,
};

/** Persian labels for roles (used on the customers/roles admin screens). */
export const ROLE_LABELS: Record<Role, string> = {
  customer: "مشتری",
  vendor: "فروشنده",
  admin: "مدیر کل",
  staff: "اپراتور",
};

export function isRole(value: unknown): value is Role {
  return (
    value === "customer" ||
    value === "vendor" ||
    value === "admin" ||
    value === "staff"
  );
}

/** True when the role may enter the admin panel (admin superuser or staff). */
export function isStaff(role: Role | string | undefined | null): boolean {
  return role === "admin" || role === "staff";
}

/** Panel roles that appear in the server capability matrix. */
export type PanelRole = "admin" | "staff";

export function isPanelRole(value: unknown): value is PanelRole {
  return value === "admin" || value === "staff";
}

/**
 * Static capability defaults for a role. Prefer live server matrix when
 * available (see `resolveLivePermissions` / CapabilityMatrix).
 */
export function permissionsForRole(
  role: Role | string | undefined | null,
): Permission[] {
  if (!role) return [];
  // Prefer operator-saved dynamic matrix (browser cache of last server load)
  // when available. Server remains source of truth for API enforcement.
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        "rumera:role-capability-matrix:v1",
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<
          Record<PanelRole, Permission[]>
        >;
        if (role === "admin" || role === "staff") {
          const fromStore = parsed[role];
          if (Array.isArray(fromStore)) {
            // Admin remains superuser for FE affordances even if the stored
            // row is incomplete (mirrors backend fail-open for admin).
            if (role === "admin" && fromStore.length === 0) return ALL;
            return fromStore;
          }
        }
      }
    } catch {
      // Fall through to static defaults.
    }
  }
  if (role === "admin") return ALL;
  return ROLE_PERMISSIONS[role as Role] ?? [];
}
