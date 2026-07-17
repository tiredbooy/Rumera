"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- The terminal fallback must not depend on next/link. */

import "./globals.css";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function GlobalError({
  error,
  unstable_retry,
}: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <head>
        <title>خطای غیرمنتظره | رومرا</title>
        <style>{`html { color-scheme: light dark; } body { margin: 0; }`}</style>
      </head>
      <body
        className="min-h-dvh bg-background text-foreground antialiased"
        style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
      >
        <main
          id="main-content"
          tabIndex={-1}
          className="container-px mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center py-14"
        >
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="w-full max-w-2xl rounded-[2rem] border border-border/70 bg-card px-6 py-12 text-center shadow-e2 sm:px-12 sm:py-16"
          >
            <p className="eyebrow justify-center">خطای غیرمنتظره</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
              رومرا در دسترس نیست
            </h1>
            <p className="mt-4 leading-8 text-muted-foreground">
              مشکلی در نمایش برنامه پیش آمده است. دوباره تلاش کنید یا از صفحهٔ
              اصلی شروع کنید.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={unstable_retry}
                className="inline-flex h-11 min-w-36 cursor-pointer items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                تلاش دوباره
              </button>
              <a
                href="/"
                className="inline-flex h-11 min-w-36 items-center justify-center rounded-md border border-border bg-background px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                بازگشت به خانه
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
