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
  fetchCapabilityMatrixBrowser,
  replaceRoleCapabilitiesBrowser,
} from "@/lib/rbac/capabilities-api";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PanelRole,
} from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rumera:role-capability-matrix:v1";
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];
/** Only panel roles are durable on the server capability matrix. */
const EDITABLE_ROLES: PanelRole[] = ["admin", "staff"];

type Matrix = Record<PanelRole, Permission[]>;

function emptyMatrix(): Matrix {
  return {
    admin: [...ROLE_PERMISSIONS.admin],
    staff: [...ROLE_PERMISSIONS.staff],
  };
}

function cacheMatrix(matrix: Matrix) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
    window.dispatchEvent(
      new CustomEvent("rumera:capabilities-updated", { detail: matrix }),
    );
  } catch {
    // Cache is best-effort; server remains source of truth.
  }
}

/**
 * Dynamic capability matrix for admin operators (Task 082a).
 *
 * Loads and saves against `GET/PUT /admin/capabilities` (via BFF). localStorage
 * is only a same-tab cache so nav can refresh without a full reload.
 */
export function CapabilityMatrix() {
  const [matrix, setMatrix] = React.useState<Matrix>(() => emptyMatrix());
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadFromServer = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchCapabilityMatrixBrowser();
      const next = emptyMatrix();
      for (const row of payload.capabilities) {
        if (row.role === "admin" || row.role === "staff") {
          next[row.role] = (row.permissions ?? []) as Permission[];
        }
      }
      // Admin superuser: never present an empty catalogue in the editor.
      if (next.admin.length === 0) {
        next.admin = [...ROLE_PERMISSIONS.admin];
      }
      setMatrix(next);
      cacheMatrix(next);
      setDirty(false);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "بارگذاری ماتریس ناموفق بود",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  function toggle(role: PanelRole, permission: Permission) {
    setMatrix((current) => {
      const set = new Set(current[role]);
      if (set.has(permission)) set.delete(permission);
      else set.add(permission);
      return { ...current, [role]: Array.from(set) };
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      // Persist both panel roles; admin row is documentary + UI (enforcement
      // still treats admin as superuser).
      const [adminRow, staffRow] = await Promise.all([
        replaceRoleCapabilitiesBrowser("admin", matrix.admin),
        replaceRoleCapabilitiesBrowser("staff", matrix.staff),
      ]);
      const next: Matrix = {
        admin: (adminRow.permissions ?? matrix.admin) as Permission[],
        staff: (staffRow.permissions ?? matrix.staff) as Permission[],
      };
      if (next.admin.length === 0) {
        next.admin = [...ROLE_PERMISSIONS.admin];
      }
      setMatrix(next);
      cacheMatrix(next);
      setDirty(false);
      toast.success("ماتریس دسترسی ذخیره شد", {
        description:
          "سرور منبع حقیقت است. درخواست بعدی API با گرنت تازه enforce می‌شود؛ ناوبری پس از رفرش/بارگذاری ماتریس به‌روز می‌شود. لغو دسترسی میان‌نشست، درخواست‌های بعدی را 403 می‌کند (JWT نقش را هر بار از DB زنده می‌خواند).",
      });
    } catch (err) {
      toast.error("ذخیرهٔ ماتریس ناموفق بود", {
        description:
          err instanceof Error ? err.message : "دسترسی یا اتصال را بررسی کنید.",
      });
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setMatrix(emptyMatrix());
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
            گرنت‌های نقش «اپراتور» و «مدیر کل» از سرور خوانده و ذخیره می‌شوند.
            مدیر کل همیشه سوپریوزر است (حتی اگر ردیف ماتریس خالی شود، سرور
            کاتالوگ کامل را نگه می‌دارد). اپراتور فقط قابلیت‌های اعطاشده را
            می‌بیند و API همان را enforce می‌کند — خالی کردن همهٔ تیک‌های اپراتور
            مجاز است.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadFromServer()}
            disabled={loading || saving}
          >
            بارگذاری مجدد
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetDefaults}
            disabled={loading || saving}
          >
            بازگشت به پیش‌فرض
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || loading || saving}
          >
            {saving ? "در حال ذخیره…" : "ذخیرهٔ ماتریس"}
          </Button>
        </div>
      </div>

      {loadError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          در حال بارگذاری ماتریس از سرور…
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
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
                  return (
                    <td key={role} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className={cn("size-4 accent-primary")}
                        checked={checked}
                        disabled={loading || saving}
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

/** Read the browser-cached matrix for same-tab nav filtering. */
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
