"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  icon,
  children,
  className,
  sectionId,
  collapsible = false,
  defaultOpen = true,
  hasError = false,
  summary,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  sectionId?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hasError?: boolean;
  summary?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isOpen = !collapsible || open || hasError;

  const sectionClassName = cn(
    "border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6",
    hasError && "ring-destructive/30",
    className,
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <fieldset
          className={sectionClassName}
          data-invalid={hasError || undefined}
        >
          <legend className="w-full px-1">
            <CollapsibleTrigger asChild>
              <button
                id={sectionId ? `${sectionId}-trigger` : undefined}
                type="button"
                className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-start focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-serif text-base">
                    {icon ? (
                      <span className="text-muted-foreground [&>svg]:size-4">
                        {icon}
                      </span>
                    ) : null}
                    {title}
                  </span>
                  {description ? (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {description}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {hasError ? (
                    <span className="text-destructive">نیاز به بررسی</span>
                  ) : !isOpen ? (
                    summary
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </span>
              </button>
            </CollapsibleTrigger>
          </legend>
          <CollapsibleContent
            forceMount
            hidden={!isOpen}
            onFocusCapture={() => setOpen(true)}
          >
            <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
          </CollapsibleContent>
        </fieldset>
      </Collapsible>
    );
  }

  return (
    <fieldset className={sectionClassName} data-invalid={hasError || undefined}>
      <legend className="flex items-center gap-2 px-1 font-serif text-base">
        {icon ? (
          <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        ) : null}
        {title}
      </legend>
      {description ? (
        <p className="-mt-0.5 mb-1 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
  full,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint ? (
          <span
            id={fieldDescriptionId(id)}
            className="text-[11px] text-muted-foreground"
          >
            {hint}
          </span>
        ) : null}
      </div>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children as React.ReactElement}
      </FieldControl>
      {error ? (
        <p
          id={fieldErrorId(id)}
          role="alert"
          className="flex items-center gap-1 text-xs text-destructive"
        >
          <span className="inline-block size-1 rounded-full bg-destructive" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
