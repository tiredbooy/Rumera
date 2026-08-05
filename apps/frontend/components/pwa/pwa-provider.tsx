"use client";

import * as React from "react";

import { isPwaRuntimeEnabled } from "@/lib/pwa/config";

import { PwaInstallPrompt } from "./pwa-install-prompt";
import { PwaUpdateToast } from "./pwa-update-toast";

/**
 * Registers the service worker (production or NEXT_PUBLIC_PWA=1) and mounts
 * install + update UX. Safe to nest under Providers — no SSR side effects.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] =
    React.useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = React.useState(false);

  React.useEffect(() => {
    if (!isPwaRuntimeEnabled()) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        setRegistration(reg);

        const onUpdateFound = () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReady(true);
            }
          });
        };

        reg.addEventListener("updatefound", onUpdateFound);
        // Proactive update check
        void reg.update().catch(() => {});
      })
      .catch((error) => {
        console.warn("PWA service worker registration failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      <PwaInstallPrompt />
      <PwaUpdateToast
        visible={updateReady}
        registration={registration}
        onDismiss={() => setUpdateReady(false)}
      />
    </>
  );
}
