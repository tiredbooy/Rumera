"use client";

import * as React from "react";
import { History, X } from "lucide-react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";

/**
 * Local autosave for the long-form editors, so a forty-minute post survives a
 * reload or a crash instead of living only in React state.
 *
 * Storage is sessionStorage, not localStorage and not a server draft column:
 * it is scoped to one tab, so a draft cannot leak to the next operator on a
 * shared machine and cannot outlive the tab that wrote it, while still
 * surviving a reload and the browser's own session restore. It also matches
 * the recovery envelope ProductForm already keeps there.
 *
 * A stored draft is never applied on its own — recovery is always the
 * operator's explicit choice, and a draft written against an older revision is
 * flagged as such before they make it.
 */

const DRAFT_DEBOUNCE_MS = 1000;

type StoredDraft<TValues> = {
  values: TValues;
  /** The server revision the draft was typed on top of. */
  revision: string | null;
  savedAt: number;
};

export type RecoverableDraft = {
  savedAt: number;
  /** The record changed on the server after this draft was captured. */
  stale: boolean;
};

export function useFormDraft<TValues extends FieldValues>({
  storageKey,
  form,
  revision,
  enabled = true,
}: {
  /** Must identify one record — a draft shown on the wrong item is a bug. */
  storageKey: string;
  form: UseFormReturn<TValues>;
  revision?: string | null;
  enabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<StoredDraft<TValues> | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  // The pending autosave lives in a ref so clear() can cancel it. Without that,
  // a save that lands inside the debounce window re-writes the draft it just
  // cleared, and the record comes back as a phantom recovery offer.
  const autosaveTimer = React.useRef<number | null>(null);

  // Reading isDirty during render is what subscribes react-hook-form's
  // formState proxy; the flag is not maintained for a consumer that never
  // reads it, so without this read autosave would silently write nothing for
  // any form that does not render isDirty itself. The ref keeps the debounce
  // callback off the effect's dependency list — restarting it on every dirty
  // flip would cancel the timer the first keystroke just scheduled.
  const isDirty = form.formState.isDirty;
  const isDirtyRef = React.useRef(isDirty);
  React.useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const clear = React.useCallback(() => {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    setDraft(null);
    setSavedAt(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Editing still works when session storage is unavailable.
    }
  }, [storageKey]);

  // Read once per record. Later autosaves must not re-open the banner.
  React.useEffect(() => {
    if (!enabled) return;
    let stored: StoredDraft<TValues> | null = null;
    try {
      const serialized = sessionStorage.getItem(storageKey);
      if (!serialized) return;
      stored = JSON.parse(serialized) as StoredDraft<TValues>;
    } catch {
      stored = null;
    }
    if (!stored?.values || typeof stored.savedAt !== "number") {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore malformed state when session storage is unavailable.
      }
      return;
    }
    // Deferred like ProductForm's recovery read: the offer belongs to the
    // storage read, not to the render that scheduled it.
    const recovered = stored;
    const timer = window.setTimeout(() => setDraft(recovered), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, storageKey]);

  React.useEffect(() => {
    if (!enabled) return;
    // Debounced because a keystroke is not an edit worth persisting; the write
    // is local either way, so autosave never puts a request on the wire.
    const subscription = form.watch(() => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
      }
      autosaveTimer.current = window.setTimeout(() => {
        autosaveTimer.current = null;
        // A clean form has nothing to recover, and an autosaved draft is still
        // unsaved work — this never touches the form's dirty state.
        if (!isDirtyRef.current) return;
        const entry: StoredDraft<TValues> = {
          values: form.getValues(),
          revision: revision ?? null,
          savedAt: Date.now(),
        };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(entry));
          setSavedAt(entry.savedAt);
        } catch {
          // A full or blocked session storage must not break the editor.
        }
      }, DRAFT_DEBOUNCE_MS);
    });
    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      subscription.unsubscribe();
    };
  }, [enabled, form, revision, storageKey]);

  const restore = React.useCallback(() => {
    if (!draft) return;
    // keepDefaultValues leaves the server record as the baseline, so the
    // recovered draft still reads as dirty and the navigation guard keeps it.
    form.reset(draft.values, { keepDefaultValues: true });
    setDraft(null);
    setSavedAt(draft.savedAt);
  }, [draft, form]);

  const recoverable: RecoverableDraft | null = draft
    ? {
        savedAt: draft.savedAt,
        stale: (draft.revision ?? null) !== (revision ?? null),
      }
    : null;

  return { draft: recoverable, savedAt, restore, discard: clear, clear };
}

function draftTime(savedAt: number) {
  return new Date(savedAt).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Recovery offer while a draft is pending, autosave receipt afterwards. */
export function FormDraftNotice({
  draft,
  savedAt,
  onRestore,
  onDiscard,
  className,
}: {
  draft: RecoverableDraft | null;
  savedAt: number | null;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}) {
  if (draft) {
    return (
      <div
        role="status"
        className={`border-hairline rounded-2xl bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/30 ${className ?? ""}`}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
          <History className="size-4 shrink-0" aria-hidden />
          پیش‌نویس ذخیره‌نشده از ساعت {draftTime(draft.savedAt)} پیدا شد
        </p>
        <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
          {draft.stale
            ? "این مطلب پس از نوشتن پیش‌نویس روی سرور به‌روزرسانی شده است. با بازیابی، نسخهٔ شما جایگزین چیزی می‌شود که اکنون می‌بینید — پیش از ذخیره آن را مرور کنید."
            : "نسخهٔ روی سرور از زمان این پیش‌نویس تغییر نکرده است. بازیابی، متن شما را برمی‌گرداند ولی چیزی را ذخیره نمی‌کند."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onRestore}>
            بازیابی پیش‌نویس
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDiscard}
          >
            <X className="size-4" aria-hidden />
            دور انداختن
          </Button>
        </div>
      </div>
    );
  }

  if (savedAt === null) return null;

  return (
    <p
      role="status"
      className={`px-1 text-xs text-muted-foreground ${className ?? ""}`}
    >
      پیش‌نویس محلی در ساعت {draftTime(savedAt)} نگه داشته شد — هنوز ذخیره نشده
      است.
    </p>
  );
}
