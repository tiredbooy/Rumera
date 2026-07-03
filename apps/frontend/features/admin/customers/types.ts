import { BaseFilter } from "@/lib/types/filters";

export interface CustomerList {
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role?: string;
  total_orders?: number;
  is_active?: boolean;
  created_at: string;
}

export interface CustomerDetails extends CustomerList {
  national_code?: string;
  email_verified?: boolean;
  gender?: string;
  birth_date?: string;
  first_name?: string;
  last_name?: string;
  last_login_at?: string;
  updated_at: string;
}

export interface CreateUserReq {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  national_code?: string;
  birth_date?: string;
  gender?: string;
  role: string;
  is_active?: boolean;
}

export interface UpdateUserReq {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  national_code?: string;
  birth_date?: string;
  gender?: string;
  role?: string;
  is_active?: boolean;
}

export interface CustomerFilter extends BaseFilter {
  is_active?: boolean;
  role?: string;
  gender?: string;
  created_from?: string;
  created_to?: string;
}
