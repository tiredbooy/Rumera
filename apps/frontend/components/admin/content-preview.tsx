"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { EditorialContent } from "@/components/editorial-content";
import { Button } from "@/components/ui/button";

/**
 * CE-1. Renders unsaved editor content exactly as the public page will.
 *
 * It reuses `EditorialContent` — the same component the storefront renders —
 * rather than restyling the editor surface, which is the whole point: the author
 * sees the real sanitizer (tags the allowlist drops vanish here, before
 * publishing), the real Markdown fallback for legacy bodies, and the real
 * `prose-rumera` typography. The Tiptap surface above is styled `prose-recipe`,
 * a denser back-office scale, so it never showed what actually ships.
 *
 * Body only, deliberately: no hero, title or related-posts chrome. Those live
 * behind server-only fetches, and the complaint this answers is not seeing a
 * rendered heading or blockquote before it is live.
 */
export function ContentPreview({
  content,
  emptyMessage,
  title = "پیش‌نمایش انتشار",
}: {
  content: string;
  emptyMessage: string;
  title?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section
      className="border-hairline mt-4 rounded-xl bg-background/40 p-4"
      data-testid="content-preview"
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <>
              <EyeOff className="size-3.5" aria-hidden /> پنهان کردن
            </>
          ) : (
            <>
              <Eye className="size-3.5" aria-hidden /> نمایش
            </>
          )}
        </Button>
      </header>
      {open ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            همان‌طور که در سایت دیده می‌شود. قالب‌بندی‌های پشتیبانی‌نشده حذف
            می‌شوند.
          </p>
          <div className="mt-3" data-testid="content-preview-body">
            <EditorialContent content={content} emptyMessage={emptyMessage} />
          </div>
        </>
      ) : null}
    </section>
  );
}
