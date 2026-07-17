import type { ReactElement, ReactNode } from "react";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-hairline max-w-2xl rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
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
      {error ? (
        <p id={fieldErrorId(id)} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldDescriptionId(id)} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
