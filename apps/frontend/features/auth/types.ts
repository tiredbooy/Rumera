import type { Role } from "@/lib/rbac/roles"
import type { UserGender, UserProfile } from "@/features/profile/types"

export type RegistrationRole = Extract<Role, "customer" | "admin" | "vendor">

export interface SignInInput {
  email: string
  password: string
}

/** POST /auth/register body. A supplied role is validated but always ignored. */
export interface SignUpInput extends SignInInput {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  national_code?: string | null
  birth_date?: string | null
  gender?: UserGender | null
  role?: RegistrationRole | null
}

export interface RefreshTokenInput {
  refresh_token: string
}

export interface RequestOtpInput {
  phone: string
}

export interface VerifyOtpInput extends RequestOtpInput {
  code: string
}

export interface ForgotPasswordInput {
  email: string
}

export interface ResetPasswordInput {
  token: string
  new_password: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

/** Register, password sign-in, and OTP verification always include the user. */
export interface AuthResult extends TokenPair {
  user: UserProfile
}

/** Claims read from the backend-signed access token by the server auth adapter. */
export interface AccessTokenClaims {
  uid: number
  user_id: string
  role: Role
  sub: string
  exp: number
  iat: number
  jti?: string
}
