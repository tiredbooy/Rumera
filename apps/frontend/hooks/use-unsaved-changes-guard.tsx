"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The navigation guard ProductForm grew for its aggregate save, lifted out so
 * every admin form gets the same three exits covered: the browser unload, an
 * in-app <Link>/anchor click, and the back button. Cancel buttons opt in by
 * routing through `requestNavigation` instead of `router.push`.
 */

const HISTORY_GUARD_KEY = "__rumeraUnsavedGuard";

/**
 * Guards that are currently blocking. Anchor clicks are caught by a listener,
 * but a programmatic `router.push` (the ⌘K palette) is invisible to the DOM —
 * those callers ask here instead. At most one admin form is on screen at a
 * time, so a set of one is all this ever holds.
 */
const activeGuards = new Set<(href: string) => void>();

/**
 * Hand a programmatic navigation to the active unsaved-changes guard.
 * Returns true when a guard took it over (the dialog is now open and will do
 * the pushing); the caller must not navigate itself in that case.
 */
export function requestGuardedNavigation(href: string): boolean {
  for (const request of activeGuards) {
    request(href);
    return true;
  }
  return false;
}

type PendingNavigation = { kind: "route"; href: string } | { kind: "history" };

type HistoryGuard = { id: string; href: string; previousState: unknown };

export type UnsavedChangesGuard = {
  /** Route away, showing the dialog first when there is unsaved work. */
  requestNavigation: (href: string) => void;
  /**
   * Stand the guard down for a navigation the form itself owns — the
   * submit-then-redirect path. It re-arms by itself once the form is clean
   * again, so a form that stays put after saving keeps its protection.
   */
  release: () => void;
  /** Spread onto {@link UnsavedChangesDialog}. */
  dialogProps: {
    open: boolean;
    isSaving: boolean;
    onStay: () => void;
    onDiscard: () => void;
  };
};

export function useUnsavedChangesGuard({
  enabled,
  isSaving = false,
}: {
  /** Usually react-hook-form's `formState.isDirty`. */
  enabled: boolean;
  /** Keeps the operator from abandoning a save whose result is still unknown. */
  isSaving?: boolean;
}): UnsavedChangesGuard {
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingNavigation | null>(null);
  const [released, setReleased] = React.useState(false);
  const historyGuardRef = React.useRef<HistoryGuard | null>(null);
  const allowHistoryNavigationRef = React.useRef(false);

  const blocking = enabled || isSaving;
  const [lastBlocking, setLastBlocking] = React.useState(blocking);
  // A form that saves in place (site settings, inline editors) goes clean
  // instead of unmounting; that is the moment to re-arm for the next edit.
  if (lastBlocking !== blocking) {
    setLastBlocking(blocking);
    if (!blocking && released) setReleased(false);
  }
  const active = blocking && !released;

  const releaseHistoryGuard = React.useCallback(() => {
    const guard = historyGuardRef.current;
    if (!guard) return;
    // Only unwind our own stamp, and only while we are still on the entry it
    // was written to — otherwise we would hand our state to another page.
    if (
      guard.href === window.location.href &&
      historyGuardID(window.history.state) === guard.id
    ) {
      window.history.replaceState(guard.previousState, "", guard.href);
    }
    historyGuardRef.current = null;
  }, []);

  const release = React.useCallback(() => {
    releaseHistoryGuard();
    setReleased(true);
  }, [releaseHistoryGuard]);

  React.useEffect(() => {
    if (!active) return;
    const guardUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", guardUnload);
    return () => window.removeEventListener("beforeunload", guardUnload);
  }, [active]);

  React.useEffect(() => {
    if (!active) return;

    const guardLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      // PE-3: section jump links are same-page anchors. We listen in the
      // capture phase, so their own preventDefault has not run yet — the
      // dialog must bow out here or every "jump to section" click traps the
      // operator in a false alarm.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ kind: "route", href: next });
    };

    document.addEventListener("click", guardLinkNavigation, true);
    return () =>
      document.removeEventListener("click", guardLinkNavigation, true);
  }, [active]);

  React.useEffect(() => {
    if (!active) return;

    let guard = historyGuardRef.current;
    if (!guard) {
      const previousState: unknown = window.history.state;
      guard = {
        id: globalThis.crypto.randomUUID(),
        href: window.location.href,
        previousState,
      };
      const state =
        previousState && typeof previousState === "object"
          ? { ...previousState, [HISTORY_GUARD_KEY]: guard.id }
          : { [HISTORY_GUARD_KEY]: guard.id };
      try {
        window.history.replaceState(state, "", guard.href);
        historyGuardRef.current = guard;
      } catch {
        return;
      }
    }

    const guardHistoryNavigation = (event: PopStateEvent) => {
      if (allowHistoryNavigationRef.current) {
        allowHistoryNavigationRef.current = false;
        return;
      }
      if (historyGuardID(event.state) === guard.id) return;
      setPendingNavigation({ kind: "history" });
      window.history.forward();
    };

    window.addEventListener("popstate", guardHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", guardHistoryNavigation);
      if (historyGuardRef.current?.id === guard.id) releaseHistoryGuard();
    };
  }, [active, releaseHistoryGuard]);

  const requestNavigation = React.useCallback(
    (href: string) => {
      if (active) {
        setPendingNavigation({ kind: "route", href });
        return;
      }
      router.push(href);
    },
    [active, router],
  );

  React.useEffect(() => {
    if (!active) return;
    activeGuards.add(requestNavigation);
    return () => {
      activeGuards.delete(requestNavigation);
    };
  }, [active, requestNavigation]);

  const onStay = React.useCallback(() => setPendingNavigation(null), []);

  const onDiscard = React.useCallback(() => {
    if (isSaving) return;
    const navigation = pendingNavigation;
    setPendingNavigation(null);
    if (!navigation) return;
    releaseHistoryGuard();
    // The operator chose to leave; asking again on the way out is the "cries
    // wolf" failure the guard exists to avoid.
    setReleased(true);
    if (navigation.kind === "route") {
      router.push(navigation.href);
      return;
    }
    allowHistoryNavigationRef.current = true;
    window.history.back();
  }, [isSaving, pendingNavigation, releaseHistoryGuard, router]);

  return {
    requestNavigation,
    release,
    dialogProps: {
      open: pendingNavigation !== null,
      isSaving,
      onStay,
      onDiscard,
    },
  };
}

export function UnsavedChangesDialog({
  open,
  isSaving,
  onStay,
  onDiscard,
}: UnsavedChangesGuard["dialogProps"]) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert className="text-destructive" aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isSaving ? "ذخیره در حال انجام است" : "تغییرات ذخیره نشده‌اند"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSaving
              ? "تا مشخص شدن نتیجهٔ ذخیره در این صفحه بمانید تا کار نیمه‌کاره رها نشود."
              : "با خروج از این صفحه، تغییرات ذخیره‌نشدهٔ این فرم از دست می‌روند."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>ادامهٔ ویرایش</AlertDialogCancel>
          {isSaving ? null : (
            <AlertDialogAction variant="destructive" onClick={onDiscard}>
              خروج بدون ذخیره
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function historyGuardID(state: unknown) {
  if (!state || typeof state !== "object") return undefined;
  const id = (state as Record<string, unknown>)[HISTORY_GUARD_KEY];
  return typeof id === "string" ? id : undefined;
}
