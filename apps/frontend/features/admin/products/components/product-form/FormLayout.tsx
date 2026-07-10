"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={cn(
        "border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6",
        className,
      )}
    >
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
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <span className="inline-block size-1 rounded-full bg-destructive" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
