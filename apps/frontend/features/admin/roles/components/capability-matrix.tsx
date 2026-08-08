"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  type Permission,
} from "@/lib/rbac/permissions";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Role,
} from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rumera:role-capability-matrix:v1";
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];
const EDITABLE_ROLES: Role[] = ["admin", "vendor", "customer"];

type Matrix = Record<Role, Permission[]>;

function loadMatrix(): Matrix {
  if (typeof window === "undefined") {
    return { ...ROLE_PERMISSIONS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...ROLE_PERMISSIONS };
    const parsed = JSON.parse(raw) as Partial<Matrix>;
    return {
      customer: parsed.customer ?? ROLE_PERMISSIONS.customer,
      vendor: parsed.vendor ?? ROLE_PERMISSIONS.vendor,
      admin: parsed.admin ?? ROLE_PERMISSIONS.admin,
    };
  } catch {
    return { ...ROLE_PERMISSIONS };
  }
}

/**
 * Dynamic capability matrix for admin operators (Task 082a).
 *
 * Backend still authorizes the admin API by live `role=admin` (single-role gate).
 * This matrix drives frontend nav/action affordances and is persisted locally so
 * operators can design lower-privilege admin packages before a full authz service
 * ships. Saving also broadcasts a `rumera:capabilities-updated` event so the
 * shell can refresh filterNav in the same tab.
 */
export function CapabilityMatrix() {
  const [matrix, setMatrix] = React.useState<Matrix>(() => ({
    ...ROLE_PERMISSIONS,
  }));
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setMatrix(loadMatrix());
  }, []);

  function toggle(role: Role, permission: Permission) {
    if (role === "customer") return;
    setMatrix((current) => {
      const set = new Set(current[role]);
      if (set.has(permission)) set.delete(permission);
      else set.add(permission);
      return { ...current, [role]: Array.from(set) };
    });
    setDirty(true);
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
      window.dispatchEvent(
        new CustomEvent("rumera:capabilities-updated", { detail: matrix }),
      );
      setDirty(false);
      toast.success("ماتریس دسترسی ذخیره شد", {
        description:
          "ناوبری پنل در این مرورگر بر اساس این ماتریس فیلتر می‌شود. دروازهٔ API همچنان نقش admin است.",
      });
    } catch {
      toast.error("ذخیرهٔ ماتریس در مرورگر ممکن نشد");
    }
  }

  function resetDefaults() {
    setMatrix({ ...ROLE_PERMISSIONS });
    setDirty(true);
  }

  return (
    <section
      className="border-hairline mt-8 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
      aria-labelledby="capability-matrix-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="capability-matrix-title" className="font-serif text-lg">
            ماتریس دسترسی پویا
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            مشخص کنید هر نقش چه بخش‌هایی از پنل را ببیند. نقش «مدیر کل» برای ورود
            به API لازم است؛ با کم‌کردن قابلیت‌ها می‌توانید ادمین‌های کم‌دسترسی
            طراحی کنید (فیلتر ناوبری/دکمه‌ها در فرانت).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetDefaults}>
            بازگشت به پیش‌فرض
          </Button>
          <Button type="button" onClick={save} disabled={!dirty}>
            ذخیرهٔ ماتریس
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 text-start">
              <th className="sticky start-0 bg-card py-2 pe-4 font-medium">
                قابلیت
              </th>
              {EDITABLE_ROLES.map((role) => (
                <th key={role} className="px-2 py-2 font-medium">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((permission) => (
              <tr
                key={permission}
                className="border-b border-border/40 last:border-0"
              >
                <th
                  scope="row"
                  className="sticky start-0 bg-card py-2.5 pe-4 text-start font-normal"
                >
                  <span className="block">{PERMISSION_LABELS[permission]}</span>
                  <span
                    className="mt-0.5 block font-mono text-[10px] text-muted-foreground"
                    dir="ltr"
                  >
                    {permission}
                  </span>
                </th>
                {EDITABLE_ROLES.map((role) => {
                  const checked = matrix[role]?.includes(permission) ?? false;
                  const locked = role === "customer";
                  return (
                    <td key={role} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className={cn(
                          "size-4 accent-primary",
                          locked && "cursor-not-allowed opacity-40",
                        )}
                        checked={checked}
                        disabled={locked}
                        aria-label={`${PERMISSION_LABELS[permission]} — ${ROLE_LABELS[role]}`}
                        onChange={() => toggle(role, permission)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Read the operator-saved matrix (browser) for nav filtering. */
export function readStoredCapabilityMatrix(): Matrix | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Matrix;
  } catch {
    return null;
  }
}
