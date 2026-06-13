/**
 * next-auth v5 route handlers — backs `/api/auth/*` (sign-in, callback,
 * session, CSRF…). The whole flow is configured in `lib/auth/auth.ts`.
 */
import { handlers } from "@/lib/auth/auth"

export const { GET, POST } = handlers
