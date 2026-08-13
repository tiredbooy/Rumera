/**
 * Frontend capability predicates shared by guards and UI. Backend repeats the
 * same checks with RequirePermission on admin surfaces.
 */
import type { Permission } from "./permissions";

type PermissionCarrier =
  | { permissions?: Permission[] | null }
  | null
  | undefined;

/** True if the session holds the given permission. */
export function can(
  session: PermissionCarrier,
  permission: Permission,
): boolean {
  return !!session?.permissions?.includes(permission);
}

/** True if the session holds at least one of the given permissions. */
export function hasAny(
  session: PermissionCarrier,
  ...permissions: Permission[]
): boolean {
  if (!session?.permissions?.length) return false;
  return permissions.some((p) => session.permissions!.includes(p));
}

/** True if the session holds every one of the given permissions. */
export function hasAll(
  session: PermissionCarrier,
  ...permissions: Permission[]
): boolean {
  if (!session?.permissions?.length) return false;
  return permissions.every((p) => session.permissions!.includes(p));
}
