"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Section({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4">
        <h2 className="eyebrow">
          <Icon className="size-3.5" aria-hidden />
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
        {children}
      </div>
    </section>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  full,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactElement;
  full?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children as ReactElement}
      </FieldControl>
      {hint && !error ? (
        <p id={fieldDescriptionId(id)} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p id={fieldErrorId(id)} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
