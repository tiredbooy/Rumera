import Link from "next/link";
import { History, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AdminUserAuditAction,
  AdminUserAuditEvent,
} from "@/features/customers/types";
import { faNum } from "@/lib/products";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import type { Pagination } from "@/lib/api/types";
import { faDate, faDateTime } from "@/lib/utils/date";

const ACTION_LABELS: Record<AdminUserAuditAction, string> = {
  "user.created": "ساخت کاربر",
  "user.updated": "ویرایش کاربر",
  "user.deactivated": "غیرفعال‌سازی کاربر",
};

const FIELD_LABELS: Record<string, string> = {
  email: "ایمیل",
  password: "گذرواژه",
  first_name: "نام",
  last_name: "نام خانوادگی",
  phone: "تلفن",
  national_code: "کد ملی",
  birth_date: "تاریخ تولد",
  gender: "جنسیت",
  role: "نقش",
  is_active: "وضعیت",
};

const GENDER_LABELS: Record<string, string> = {
  female: "زن",
  male: "مرد",
  other: "دیگر",
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLE_LABELS;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "خالی";
  if (field === "role" && isRole(value)) return ROLE_LABELS[value];
  if (field === "is_active" && typeof value === "boolean") {
    return value ? "فعال" : "غیرفعال";
  }
  if (field === "gender" && typeof value === "string") {
    return GENDER_LABELS[value] ?? value;
  }
  if (field === "birth_date" && typeof value === "string") {
    return faDate(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "مقدار ثبت‌شده";
    }
  }
  return String(value);
}

export function userAuditPageHref(userID: string, page: number): string {
  const base = `/admin/customers/${userID}`;
  return page > 1 ? `${base}?audit_page=${page}` : base;
}

export function UserAuditHistory({
  userID,
  events,
  pagination,
}: {
  userID: string;
  events: AdminUserAuditEvent[];
  pagination: Pagination;
}) {
  const newestFirst = [...events].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    return (
      (Number.isNaN(rightTime) ? 0 : rightTime) -
      (Number.isNaN(leftTime) ? 0 : leftTime)
    );
  });

  return (
    <section className="mt-6" aria-labelledby="user-audit-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="user-audit-title"
            className="flex items-center gap-2 font-serif text-lg"
          >
            <History className="size-4.5 text-primary" aria-hidden />
            تاریخچهٔ مدیریتی
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            تازه‌ترین رویدادها در ابتدای فهرست نمایش داده می‌شوند.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {faNum(pagination.total_items)} رویداد
        </p>
      </div>

      {newestFirst.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/[0.04]">
          <History className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">هنوز رویدادی ثبت نشده است</p>
          <p className="text-xs text-muted-foreground">
            ساخت، ویرایش و غیرفعال‌سازی این حساب در این بخش ثبت خواهد شد.
          </p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {newestFirst.map((event) => (
            <li key={event.event_id}>
              <article className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <UserCog className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        توسط{" "}
                        <span
                          className="break-all font-medium text-foreground"
                          dir="ltr"
                        >
                          {event.actor_email || event.actor_user_id}
                        </span>
                      </p>
                    </div>
                  </div>
                  <time
                    dateTime={event.created_at}
                    className="text-xs text-muted-foreground tabular-nums sm:shrink-0"
                  >
                    {faDateTime(event.created_at)}
                  </time>
                </div>

                <dl className="mt-4 grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-2">
                  {event.changed_fields.map((field) => {
                    const change = event.changes[field];
                    return (
                      <div
                        key={field}
                        className="rounded-xl bg-muted/30 px-3 py-2 text-xs"
                      >
                        <dt className="font-medium">
                          {FIELD_LABELS[field] ?? field}
                        </dt>
                        <dd className="mt-1 leading-relaxed text-muted-foreground">
                          {change ? (
                            <>
                              از «
                              <bdi dir="auto" className="break-all">
                                {formatValue(field, change.before)}
                              </bdi>
                              » به «
                              <bdi dir="auto" className="break-all">
                                {formatValue(field, change.after)}
                              </bdi>
                              »
                            </>
                          ) : (
                            "تغییر ثبت شد"
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            </li>
          ))}
        </ol>
      )}

      {pagination.has_prev || pagination.has_next ? (
        <nav
          className="mt-4 flex items-center justify-end gap-2"
          aria-label="صفحه‌بندی تاریخچهٔ مدیریتی"
        >
          {pagination.has_prev ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 cursor-pointer"
            >
              <Link
                href={userAuditPageHref(userID, pagination.page - 1)}
                rel="prev"
              >
                رویدادهای جدیدتر
              </Link>
            </Button>
          ) : null}
          {pagination.has_next ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-11 cursor-pointer"
            >
              <Link
                href={userAuditPageHref(userID, pagination.page + 1)}
                rel="next"
              >
                رویدادهای قدیمی‌تر
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
