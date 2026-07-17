"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  AdminCustomerApiError,
  updateAdminUser,
} from "@/features/customers/client";
import type {
  AdminUser,
  AdminUserUpdateInput,
} from "@/features/customers/types";
import {
  customerEditFormSchema,
  type CustomerEditFormValues,
} from "@/features/customers/validations";
import { AccessSection } from "./user-edit-form/AccessSection";
import { FormActions } from "./user-edit-form/FormActions";
import { IdentitySummary } from "./user-edit-form/IdentitySummary";
import { ProfileSection } from "./user-edit-form/ProfileSection";

// ── Validation ────────────────────────────────────────────────────────────────
// Everything is a string in the form; coerced to the partial-patch API shape on
// submit. Keys mirror the backend json names so 422 field errors map 1:1.

/** Western/Persian digits → ASCII; strips non-digits for storage. */
function toAsciiDigits(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** ISO/RFC3339 → `YYYY-MM-DD` for the date input (empty on parse failure). */
function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → RFC3339 at UTC midnight, or null when empty. */
function dateInputToRfc3339(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  return `${t}T00:00:00Z`;
}

const strOrNull = (v: string) => (v.trim() === "" ? null : v.trim());

function defaults(user: AdminUser): CustomerEditFormValues {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: user.phone ?? "",
    national_code: user.national_code ?? "",
    birth_date: isoToDateInput(user.birth_date),
    gender: user.gender ?? "",
    role: user.role,
    is_active: user.is_active,
  };
}

export function UserEditForm({
  user,
  /** True when the row being edited is the signed-in admin's own account. */
  isSelf,
}: {
  user: AdminUser;
  isSelf: boolean;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CustomerEditFormValues>({
    resolver: zodResolver(customerEditFormSchema),
    defaultValues: defaults(user),
  });

  const watchedActive = useWatch({ control, name: "is_active" });
  const watchedRole = useWatch({ control, name: "role" });

  function applyServerErrors(e: unknown) {
    if (e instanceof AdminCustomerApiError) {
      if (e.status === 403 || e.code === "ACCESS_DENIED") {
        toast.error("شما اجازهٔ تغییر نقش یا وضعیت این حساب را ندارید.");
        return;
      }
      if (e.status === 404 || e.code === "USER_NOT_FOUND") {
        toast.error("کاربر یافت نشد؛ ممکن است حذف یا غیرفعال شده باشد.");
        return;
      }
      if (e.fields) {
        const known = new Set<keyof CustomerEditFormValues>([
          "first_name",
          "last_name",
          "phone",
          "national_code",
          "birth_date",
          "gender",
          "role",
          "is_active",
        ]);
        Object.entries(e.fields)
          .filter(([key]) => known.has(key as keyof CustomerEditFormValues))
          .forEach(([key, msgs], index) => {
            setError(
              key as keyof CustomerEditFormValues,
              { message: msgs[0] },
              { shouldFocus: index === 0 },
            );
          });
      }
      toast.error(e.message || "ویرایش کاربر ناموفق بود.");
    } else {
      toast.error("خطای غیرمنتظره رخ داد.");
    }
  }

  async function onSubmit(v: CustomerEditFormValues) {
    const input: AdminUserUpdateInput = {
      first_name: strOrNull(v.first_name),
      last_name: strOrNull(v.last_name),
      phone: v.phone.trim() === "" ? null : toAsciiDigits(v.phone.trim()),
      national_code:
        v.national_code.trim() === ""
          ? null
          : toAsciiDigits(v.national_code.trim()),
      birth_date: dateInputToRfc3339(v.birth_date),
      gender: v.gender === "" ? null : v.gender,
    };
    // Role/status are admin-only and locked for self-edits — only send them when
    // editing someone else, so we never trip the server lock-out guard.
    if (!isSelf) {
      input.role = v.role;
      input.is_active = v.is_active;
    }

    try {
      const updated = await updateAdminUser(user.user_id, input);
      toast.success("تغییرات کاربر ذخیره شد.");
      // Re-baseline the form to the server truth (clears the dirty state).
      reset(defaults(updated));
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      noValidate
      data-testid="user-edit-form"
    >
      <div className="flex flex-col gap-6">
        <ProfileSection
          user={user}
          control={control}
          register={register}
          errors={errors}
        />
        <AccessSection
          control={control}
          watchedActive={watchedActive}
          watchedRole={watchedRole}
          isSelf={isSelf}
        />
      </div>

      <aside className="flex flex-col gap-6">
        <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
          <IdentitySummary user={user} watchedRole={watchedRole} />
          <FormActions
            isSubmitting={isSubmitting}
            isDirty={isDirty}
            onCancel={() => router.push("/admin/customers")}
          />
        </div>
      </aside>
    </form>
  );
}
