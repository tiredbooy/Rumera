import { cn } from "@/lib/utils";

/**
 * Consistent page heading for the admin console: an optional eyebrow/breadcrumb
 * slot, the title, an optional description, and right-aligned actions. Tuned for
 * a dense back-office (smaller serif than the editorial storefront) so screens
 * read like a tool, not a marketing page.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Breadcrumb / context row rendered above the title. */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h1 className="break-words font-serif text-2xl leading-tight tracking-normal [overflow-wrap:anywhere] sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 max-w-full items-center gap-2 sm:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
