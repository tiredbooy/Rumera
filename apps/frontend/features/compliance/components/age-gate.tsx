"use client";

import * as React from "react";
import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "rumera:age-verified";

/**
 * Full-screen 18+ verification shown on first visit. The choice is persisted in
 * localStorage so returning visitors are not interrupted.
 *
 * Client-only after mount: using useSyncExternalStore with a "verified" server
 * snapshot caused React to keep the SSR tree (gate never opened). Mount +
 * localStorage read is the reliable pattern for this gate.
 */
export function AgeGate() {
  // null = not hydrated yet (render nothing to avoid SSR flash / mismatch)
  const [verified, setVerified] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Intentional post-mount localStorage read: avoids SSR flash and the
    // useSyncExternalStore server/client snapshot mismatch that hid the gate.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only gate bootstrap
      setVerified(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only gate bootstrap
      setVerified(false);
    }
  }, []);

  React.useEffect(() => {
    if (verified === false) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [verified]);

  if (verified === null || verified) return null;

  function confirm() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // private mode — still dismiss for this session
    }
    setVerified(true);
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="cellar-glow border-hairline max-w-md overflow-hidden rounded-3xl bg-card p-8 text-center shadow-2xl ring-1 ring-foreground/10 sm:p-10"
      >
        <div className="mx-auto mb-6 flex justify-center">
          <RumeraBrandMark
            variant="mark"
            size="xl"
            href={null}
            tone="auto"
            decorative={false}
          />
        </div>
        <p className="eyebrow justify-center">لطفاً تأیید کنید</p>
        <DialogTitle className="mt-3 font-serif text-4xl font-normal">
          به سنِ قانونی نوشیدن رسیده‌اید؟
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm text-muted-foreground">
          برای ورود به رومرا باید ۱۸ سال یا بیشتر داشته باشید. لطفاً مسئولانه
          بنوشید.
        </DialogDescription>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-11 flex-1 text-sm" onClick={confirm}>
            بله، ۱۸ سال یا بیشتر دارم
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 flex-1 text-sm"
            onClick={() => {
              window.location.href = "https://www.google.com";
            }}
          >
            خیر، مرا بازگردان
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/80">
          با ورود، شرایط استفاده و سیاست حریم خصوصی ما را می‌پذیرید.
        </p>
      </DialogContent>
    </Dialog>
  );
}
