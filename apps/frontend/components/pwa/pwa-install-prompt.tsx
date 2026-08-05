"use client";

import * as React from "react";
import { Download, Share, X } from "lucide-react";

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { Button } from "@/components/ui/button";
import {
  isStandaloneDisplay,
  needsManualIosInstall,
  PWA_INSTALL_DISMISS_KEY,
} from "@/lib/pwa/install";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Mobile-first install surface:
 * - Chromium: native beforeinstallprompt
 * - iOS Safari: manual Share → Add to Home Screen steps
 * Dismissed state is localStorage-scoped so we don't nag every visit.
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = React.useState(false);
  const [iosMode, setIosMode] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === "1") return;

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setIosMode(false);
      setOpen(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);

    // iOS: no BIP — surface guidance after a short delay (avoid first-paint noise).
    const iosTimer = window.setTimeout(() => {
      if (needsManualIosInstall() && !isStandaloneDisplay()) {
        setIosMode(true);
        setOpen(true);
      }
    }, 2800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1");
    } catch {
      // private mode
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // user dismissed
    }
    setDeferred(null);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[90] p-3 sm:inset-x-auto sm:end-4 sm:bottom-4 sm:max-w-sm",
        "[padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]",
        "[padding-left:max(0.75rem,env(safe-area-inset-left))]",
        "[padding-right:max(0.75rem,env(safe-area-inset-right))]",
      )}
    >
      <div className="border-hairline shadow-e3 relative overflow-hidden rounded-3xl bg-card/95 p-4 ring-1 ring-foreground/10 backdrop-blur-xl sm:p-5">
        <button
          type="button"
          onClick={dismiss}
          className="absolute end-3 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="بستن"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3 pe-10">
          <RumeraBrandMark variant="mark" size="lg" href={null} tone="auto" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">اپ رومرا</p>
            <h2
              id="pwa-install-title"
              className="font-serif text-xl leading-snug sm:text-2xl"
            >
              نصب فروشگاه روی دستگاه
            </h2>
            {iosMode ? (
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">۱.</span>
                  <span>
                    دکمه{" "}
                    <Share
                      className="mx-0.5 inline size-3.5 text-primary"
                      aria-hidden
                    />{" "}
                    <strong className="text-foreground">Share</strong> را در
                    نوار Safari بزنید.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">۲.</span>
                  <span>
                    گزینه{" "}
                    <strong className="text-foreground">
                      Add to Home Screen
                    </strong>{" "}
                    / «افزودن به صفحهٔ اصلی» را انتخاب کنید.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">۳.</span>
                  <span>با «Add» تأیید کنید — رومرا مثل یک اپ باز می‌شود.</span>
                </li>
              </ol>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                دسترسی سریع‌تر، حس اپلیکیشن، و مرور کاتالوگ حتی وقتی شبکه ضعیف
                است — بدون نیاز به فروشگاه اپ.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {!iosMode && deferred ? (
            <Button className="h-11 flex-1" onClick={() => void install()}>
              <Download className="size-4" aria-hidden />
              نصب اپ
            </Button>
          ) : null}
          <Button
            variant={iosMode || !deferred ? "default" : "outline"}
            className="h-11 flex-1"
            onClick={dismiss}
          >
            {iosMode ? "متوجه شدم" : "بعداً"}
          </Button>
        </div>
      </div>
    </div>
  );
}
