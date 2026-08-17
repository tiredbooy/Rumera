"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Standing instructions live here so they do not eat a row above the list. */
export function AdminHelpHint({
  label = "راهنمای صفحه",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label={label}
        >
          <CircleHelp className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 gap-2 p-3 text-xs leading-5 text-muted-foreground"
      >
        <PopoverTitle className="text-sm text-foreground">{label}</PopoverTitle>
        <div>{children}</div>
      </PopoverContent>
    </Popover>
  );
}
