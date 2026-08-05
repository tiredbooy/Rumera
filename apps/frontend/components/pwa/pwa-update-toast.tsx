"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown when a new service worker is installed while an old controller is
 * active. Activating calls SKIP_WAITING; the provider reloads on controllerchange.
 */
export function PwaUpdateToast({
  visible,
  registration,
  onDismiss,
}: {
  visible: boolean;
  registration: ServiceWorkerRegistration | null;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  function activate() {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    onDismiss();
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[91] mx-auto max-w-md sm:inset-x-auto sm:start-4"
    >
      <div className="border-hairline shadow-e3 flex flex-col gap-3 rounded-2xl bg-card/95 p-4 ring-1 ring-foreground/10 backdrop-blur-xl sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-foreground">
          نسخهٔ جدید رومرا آماده است. برای دریافت به‌روزرسانی صفحه را تازه‌سازی
          کنید.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" className="h-11 min-w-28" onClick={activate}>
            <RefreshCw className="size-4" aria-hidden />
            به‌روزرسانی
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-11"
            onClick={onDismiss}
          >
            بعداً
          </Button>
        </div>
      </div>
    </div>
  );
}
