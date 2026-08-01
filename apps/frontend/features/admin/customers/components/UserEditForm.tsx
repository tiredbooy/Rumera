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
  apiDateToInputValue,
  customerEditFormSchema,
  dateInputToApiValue,
  toAsciiDigits,
  trimmedOrNull,
  type CustomerEditFormValues,
} from "@/features/customers/validations";
import { AccessSection } from "./user-edit-form/AccessSection";
import { FormActions } from "./user-edit-form/FormActions";
import { IdentitySummary } from "./user-edit-form/IdentitySummary";
import { ProfileSection } from "./user-edit-form/ProfileSection";

function defaults(user: AdminUser): CustomerEditFormValues {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: user.phone ?? "",
    national_code: user.national_code ?? "",
    birth_date: apiDateToInputValue(user.birth_date),
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
    clearErrors,
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setFocus,
    formState: { dirtyFields, errors, isSubmitting, isDirty },
  } = useForm<CustomerEditFormValues>({
    resolver: zodResolver(customerEditFormSchema),
    defaultValues: defaults(user),
  });

  const watchedActive = useWatch({ control, name: "is_active" });
  const watchedRole = useWatch({ control, name: "role" });

  function applyServerErrors(e: unknown) {
    if (e instanceof AdminCustomerApiError) {
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
      const fieldErrors = Object.entries(e.fields ?? {}).filter(
        ([key, messages]) =>
          known.has(key as keyof CustomerEditFormValues) && messages.length > 0,
      );
      if (fieldErrors.length > 0) {
        fieldErrors.forEach(([key, messages]) => {
          setError(key as keyof CustomerEditFormValues, {
            type: "server",
            message: messages[0],
          });
        });
        const firstField = fieldErrors[0][0] as keyof CustomerEditFormValues;
        setTimeout(() => setFocus(firstField), 0);
        toast.error(e.message || "ویرایش کاربر ناموفق بود.");
        return;
      }

      const message =
        e.code === "INSUFFICIENT_PERMISSIONS" || e.status === 401
          ? "دسترسی مدیریتی این نشست لغو یا منقضی شده است. دوباره وارد شوید."
          : e.code === "ACCESS_DENIED"
            ? "این تغییر برای حفاظت از دسترسی حساب مجاز نیست."
            : e.status === 404 || e.code === "USER_NOT_FOUND"
              ? "کاربر دیگر در دسترس نیست."
              : e.message || "ویرایش کاربر ناموفق بود.";
      setError("root.server", { type: "server", message });
      toast.error(message);
      return;
    }

    const message = "خطای غیرمنتظره رخ داد. دوباره تلاش کنید.";
    setError("root.server", { type: "server", message });
    toast.error(message);
  }

  async function onSubmit(v: CustomerEditFormValues) {
    const input: AdminUserUpdateInput = {};
    if (dirtyFields.first_name) input.first_name = trimmedOrNull(v.first_name);
    if (dirtyFields.last_name) input.last_name = trimmedOrNull(v.last_name);
    if (dirtyFields.phone) {
      input.phone =
        v.phone.trim() === "" ? null : toAsciiDigits(v.phone.trim());
    }
    if (dirtyFields.national_code) {
      input.national_code =
        v.national_code.trim() === ""
          ? null
          : toAsciiDigits(v.national_code.trim());
    }
    if (dirtyFields.birth_date) {
      input.birth_date = dateInputToApiValue(v.birth_date);
    }
    if (dirtyFields.gender) input.gender = v.gender === "" ? null : v.gender;
    if (!isSelf && dirtyFields.role) input.role = v.role;
    if (!isSelf && dirtyFields.is_active && !user.is_active && v.is_active) {
      input.is_active = true;
    }

    if (Object.keys(input).length === 0) return;
    clearErrors("root.server");

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
      aria-busy={isSubmitting}
      data-testid="user-edit-form"
    >
      <div className="flex flex-col gap-6">
        <ProfileSection
          user={user}
          control={control}
          register={register}
          errors={errors}
          disabled={isSubmitting}
        />
        <AccessSection
          control={control}
          watchedActive={watchedActive}
          watchedRole={watchedRole}
          initialActive={user.is_active}
          isBanned={user.is_banned}
          isSelf={isSelf}
          errors={errors}
          disabled={isSubmitting}
        />
        {errors.root?.server?.message ? (
          <div
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
            role="alert"
          >
            {errors.root.server.message}
          </div>
        ) : null}
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
