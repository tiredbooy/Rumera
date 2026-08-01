import { z } from "zod";
import type {
  UserDetailSearchParams,
  UserListFilters,
  UserListSearchParams,
  UserStatusFilter,
} from "./types";

export const adminUserRoleSchema = z.enum(["customer", "vendor", "admin"]);
const adminUserIDSchema = z.string().uuid();

export function parseAdminUserID(value: string): string | null {
  const parsed = adminUserIDSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const optionalDateSchema = z.string().refine((value) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}, "تاریخ معتبر وارد کنید");

const profileFields = {
  first_name: z.string().trim().max(100, "حداکثر ۱۰۰ نویسه"),
  last_name: z.string().trim().max(100, "حداکثر ۱۰۰ نویسه"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9۰-۹+\-\s]{7,20}$/.test(value), {
      message: "شمارهٔ تلفن معتبر وارد کنید",
    }),
  national_code: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[0-9۰-۹]{10}$/.test(value), {
      message: "کد ملی باید ۱۰ رقم باشد",
    }),
  birth_date: optionalDateSchema,
  gender: z.union([z.literal(""), z.enum(["male", "female", "other"])]),
};

export const customerEditFormSchema = z.object({
  ...profileFields,
  role: adminUserRoleSchema,
  is_active: z.boolean(),
});

export type CustomerEditFormValues = z.infer<typeof customerEditFormSchema>;

export const adminUserCreateFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "ایمیل را وارد کنید")
    .email("ایمیل معتبر وارد کنید")
    .max(254, "ایمیل بیش از حد طولانی است"),
  password: z
    .string()
    .min(8, "گذرواژه باید حداقل ۸ کاراکتر باشد")
    .refine((value) => new TextEncoder().encode(value).length <= 72, {
      message: "گذرواژه باید حداکثر ۷۲ بایت باشد",
    }),
  ...profileFields,
  role: adminUserRoleSchema,
  is_active: z.boolean(),
});

export type AdminUserCreateFormValues = z.infer<
  typeof adminUserCreateFormSchema
>;

/** Convert Persian digits to their ASCII equivalents for API payloads. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
  );
}

/** Convert an API timestamp to the value expected by a native date input. */
export function apiDateToInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Convert a native date value to the timestamp accepted by the backend. */
export function dateInputToApiValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `${trimmed}T00:00:00Z` : null;
}

export function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

const statusFilterSchema = z.enum(["all", "active", "inactive"]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseUserListFilters(
  searchParams: UserListSearchParams,
): UserListFilters {
  const parsedPage = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(first(searchParams.page));
  const parsedRole = adminUserRoleSchema.safeParse(first(searchParams.role));
  const parsedStatus = statusFilterSchema.safeParse(first(searchParams.status));

  return {
    query: first(searchParams.q).trim().slice(0, 200),
    page: parsedPage.success ? parsedPage.data : 1,
    role: parsedRole.success ? parsedRole.data : undefined,
    status: (parsedStatus.success
      ? parsedStatus.data
      : "all") as UserStatusFilter,
  };
}

export function parseUserAuditPage(
  searchParams: UserDetailSearchParams,
): number {
  const parsed = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(first(searchParams.audit_page));
  return parsed.success ? parsed.data : 1;
}
