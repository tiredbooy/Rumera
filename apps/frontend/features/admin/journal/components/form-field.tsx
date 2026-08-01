import type { ReactElement, ReactNode } from "react";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";

export function JournalFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function JournalFormField({
  id,
  label,
  error,
  hint,
  full,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  full?: boolean;
  children: ReactElement;
}) {
  return (
    <div
      className={
        full ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"
      }
    >
      <Label htmlFor={id}>{label}</Label>
      <FieldControl id={id} error={error} description={Boolean(hint && !error)}>
        {children}
      </FieldControl>
      {error ? (
        <p
          id={fieldErrorId(id)}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={fieldDescriptionId(id)}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
