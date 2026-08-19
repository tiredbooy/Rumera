"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import type { ProductFormErrorEntry } from "../../form-errors";

export const PRODUCT_ERROR_SUMMARY_ID = "product-error-summary";

/**
 * Everything that must be fixed before this product can be saved (PE-6).
 *
 * Before this, an operator who had filled 64 variants learned only that
 * "something" was wrong and got dropped on whichever bad field came first.
 * The list is derived from the live form errors on every render, so it shrinks
 * as they are fixed instead of going stale.
 */
export function ProductErrorSummary({
  entries,
  onJump,
}: {
  entries: ProductFormErrorEntry[];
  /**
   * Opens the section holding the target and then focuses it. The form owns
   * this: since PE-5 a field can sit in a hidden section, and `focus()` on a
   * `display:none` control does nothing — the link would look live and be dead.
   */
  onJump: (targetId: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      id={PRODUCT_ERROR_SUMMARY_ID}
      role="group"
      tabIndex={-1}
      aria-labelledby={`${PRODUCT_ERROR_SUMMARY_ID}-title`}
      className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
    >
      {/* Only the count is a live region: re-reading the whole list on every
          keystroke that fixes something would nag rather than help. */}
      <p
        id={`${PRODUCT_ERROR_SUMMARY_ID}-title`}
        role="status"
        className="flex items-center gap-2 font-medium"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {entries.length.toLocaleString("fa-IR")} مورد باید پیش از ذخیره اصلاح
        شود
      </p>
      <ol className="mt-2 space-y-1">
        {entries.map((entry) => {
          const targetId = entry.targetId;
          return (
            <li key={entry.key}>
              {targetId ? (
                <a
                  href={`#${targetId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onJump(targetId);
                  }}
                  className="underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                >
                  {entry.label}: {entry.message}
                </a>
              ) : (
                <span>
                  {entry.label}: {entry.message}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
