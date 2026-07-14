/** Live customer address returned by the address endpoints. */
export interface Address {
  id: number;
  title?: string;
  full_name: string;
  phone_number?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province?: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface CreateAddressInput {
  title?: string | null;
  full_name: string;
  phone_number?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province?: string | null;
  postal_code: string;
  country: string;
  is_default?: boolean;
}

/**
 * PATCH applies only non-nil Go pointer fields. JSON null currently behaves like
 * omission, so nullable values cannot be cleared through this endpoint.
 */
export interface UpdateAddressInput {
  title?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_default?: boolean | null;
}
