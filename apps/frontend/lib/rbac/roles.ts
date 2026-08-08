/**
 * Backend roles mapped to frontend admin capability identifiers.
 *
 * The backend authorizes the admin API by the single `admin` role. Capability
 * identifiers only organize admin navigation and affordances; they are not a
 * claim that the backend grants permissions independently.
 */
import { PERMISSIONS, type Permission } from "./permissions";

/** Roles recognised by the backend (`customer` is the default self-registration). */
export type Role = "customer" | "vendor" | "admin";

const ALL: Permission[] = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  vendor: [],
  admin: ALL,
};

/** Persian labels for roles (used on the customers/roles admin screens). */
export const ROLE_LABELS: Record<Role, string> = {
  customer: "مشتری",
  vendor: "فروشنده",
  admin: "مدیر کل",
};

export function isRole(value: unknown): value is Role {
  return value === "customer" || value === "vendor" || value === "admin";
}

/** Kept for call-site stability; staff access is exactly admin access. */
export function isStaff(role: Role | string | undefined | null): boolean {
  return role === "admin";
}

export function permissionsForRole(
  role: Role | string | undefined | null,
): Permission[] {
  if (!role) return [];
  // Prefer operator-saved dynamic matrix (Task 082a) when available in-browser.
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        "rumera:role-capability-matrix:v1",
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<Role, Permission[]>>;
        const fromStore = parsed[role as Role];
        if (Array.isArray(fromStore)) return fromStore;
      }
    } catch {
      // Fall through to static defaults.
    }
  }
  return ROLE_PERMISSIONS[role as Role] ?? [];
}
