/**
 * Resolve live panel permissions from the server capability matrix.
 * Falls back to static role defaults when the matrix is unavailable.
 */
import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Permission } from "./permissions";
import {
  permissionsFromMatrix,
  type CapabilityMatrixPayload,
} from "./capabilities-api";
import { permissionsForRole, type Role } from "./roles";
import { PERMISSIONS } from "./permissions";

/**
 * Load permissions for the live panel role. Admin always receives the full
 * catalogue (superuser). Staff receives the durable server row when present.
 */
export async function resolveLivePermissions(
  role: Role | string,
  token?: string,
): Promise<Permission[]> {
  if (role === "admin") {
    return Object.values(PERMISSIONS);
  }
  if (role !== "staff") {
    return permissionsForRole(role);
  }

  try {
    const matrix = await apiFetch<CapabilityMatrixPayload>(
      "/admin/capabilities",
      token ? { token } : {},
    );
    const fromServer = permissionsFromMatrix(matrix, "staff");
    if (fromServer.length > 0) return fromServer;
  } catch {
    // Fall through to static staff defaults (seed-aligned).
  }
  return permissionsForRole("staff");
}
