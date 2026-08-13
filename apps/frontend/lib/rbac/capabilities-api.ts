/**
 * Server capability matrix client helpers (Task 082a).
 *
 * Browser: `/api/admin/admin/capabilities` (BFF, session cookie).
 * Server: `apiFetch("/admin/capabilities")` (direct backend + bearer).
 */
import type { Permission } from "./permissions";
import type { PanelRole } from "./roles";

export type RoleCapabilitiesRow = {
  role: PanelRole | string;
  permissions: Permission[] | string[];
};

export type CapabilityMatrixPayload = {
  capabilities: RoleCapabilitiesRow[];
  catalogue: string[];
};

const BROWSER_LIST_PATH = "/api/admin/admin/capabilities";

function isMatrixPayload(value: unknown): value is CapabilityMatrixPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as CapabilityMatrixPayload;
  return Array.isArray(v.capabilities) && Array.isArray(v.catalogue);
}

/** Unwrap `{ data: T }` success envelopes or return the body as-is. */
function unwrapData<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    (body as { data: unknown }).data !== undefined
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Client-side fetch of the live matrix via the admin BFF proxy. */
export async function fetchCapabilityMatrixBrowser(): Promise<CapabilityMatrixPayload> {
  const res = await fetch(BROWSER_LIST_PATH, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      res.statusText;
    throw new Error(message || `capabilities ${res.status}`);
  }
  const data = unwrapData<CapabilityMatrixPayload>(body);
  if (!isMatrixPayload(data)) {
    throw new Error("invalid capabilities payload");
  }
  return data;
}

/** Client-side replace of one role's grants via the admin BFF proxy. */
export async function replaceRoleCapabilitiesBrowser(
  role: PanelRole,
  permissions: Permission[],
): Promise<RoleCapabilitiesRow> {
  const res = await fetch(`${BROWSER_LIST_PATH}/${encodeURIComponent(role)}`, {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      res.statusText;
    throw new Error(message || `capabilities put ${res.status}`);
  }
  return unwrapData<RoleCapabilitiesRow>(body);
}

/** Pick permissions for a panel role from a matrix payload. */
export function permissionsFromMatrix(
  matrix: CapabilityMatrixPayload,
  role: string,
): Permission[] {
  const row = matrix.capabilities.find((item) => item.role === role);
  if (!row) return [];
  return (row.permissions ?? []) as Permission[];
}
