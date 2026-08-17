import "server-only";

import { resolveApiBase, resolveApiOrigin } from "./origin";

/**
 * Server-only view of the backend origin. The precedence chain lives in
 * `./origin` so the browser-safe surface and this one can never drift.
 */
export const API_ORIGIN = resolveApiOrigin();
export const API_BASE = resolveApiBase();
