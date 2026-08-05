"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableIdOption = {
  id: number;
  title: string;
};

/**
 * Searchable single-select for large admin id lists (category, brand, …).
 * Value is stored as a string id (or "") to match react-hook-form string fields.
 */
export function SearchableIdSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "انتخاب…",
  noneLabel = "بدون انتخاب",
  searchPlaceholder = "جستجو…",
  disabled = false,
  invalid = false,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: SearchableIdOption[];
  placeholder?: string;
  noneLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = options.find((option) => String(option.id) === value);
  const needle = query.trim().toLocaleLowerCase("fa");
  const filtered = needle
    ? options.filter((option) =>
        option.title.toLocaleLowerCase("fa").includes(needle),
      )
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected ? selected.title : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b border-border/60 p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 ps-8"
              aria-label={searchPlaceholder}
              autoFocus
            />
          </div>
        </div>
        <ul
          role="listbox"
          className="max-h-60 overflow-y-auto p-1"
          aria-label={placeholder}
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm",
                !value
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/70",
              )}
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
            >
              <Check
                className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                aria-hidden
              />
              {noneLabel}
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              موردی یافت نشد.
            </li>
          ) : (
            filtered.map((option) => {
              const optionValue = String(option.id);
              const active = value === optionValue;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/70",
                    )}
                    onClick={() => {
                      onChange(optionValue);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{option.title}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
