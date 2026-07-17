import type { ReactElement } from "react";

import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  id,
  label,
  error,
  children,
  hint,
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
