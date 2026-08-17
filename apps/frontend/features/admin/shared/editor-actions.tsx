"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared save / cancel stack for the recipe and journal sidebars so both
 * editors place the same two actions in the same order.
 */
export function EditorActions({
  submitLabel,
  isSubmitting,
  onCancel,
  hint,
  canWrite = true,
  children,
}: {
  submitLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
  hint?: string;
  canWrite?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {canWrite ? (
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {submitLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isSubmitting && canWrite}
        onClick={onCancel}
      >
        انصراف
      </Button>
      {children}
      {canWrite && hint ? (
        <p className="px-1 text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
