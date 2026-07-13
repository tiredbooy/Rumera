import type { Role } from "@/lib/rbac/roles"

/** Values accepted by the Go user profile validators. */
export type UserGender = "male" | "female" | "other"

/** GET/PATCH /auth/me response (`models.UserResponse`). */
export interface UserProfile {
  user_id: string
  first_name?: string
  last_name?: string
  email: string
  phone?: string
  birth_date?: string
  gender?: UserGender
  role: Role
  created_at: string
}

/** PATCH /auth/me body. Go pointer inputs accept omission or JSON null. */
export interface UpdateProfileInput {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  national_code?: string | null
  birth_date?: string | null
  gender?: UserGender | null
}
