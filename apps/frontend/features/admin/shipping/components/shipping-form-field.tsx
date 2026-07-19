import * as React from "react";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ShippingFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-hairline min-w-0 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="px-1 font-serif text-base">{title}</legend>
      {description ? (
        <p className="-mt-0.5 text-xs leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ShippingFormField({
  id,
  label,
  error,
  hint,
  full,
  bindControl = true,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  full?: boolean;
  bindControl?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {bindControl ? (
        <FieldControl
          id={id}
          error={error}
          description={Boolean(hint && !error)}
        >
          {children as React.ReactElement}
        </FieldControl>
      ) : (
        children
      )}
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
