import type { ComponentPropsWithoutRef } from "react";

type QueryStateRegionProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "aria-busy" | "aria-live" | "role"
> & {
  state?: "loading" | "error";
};

export function QueryStateRegion({ state, ...props }: QueryStateRegionProps) {
  return (
    <div
      {...props}
      role={
        state === "loading" ? "status" : state === "error" ? "alert" : undefined
      }
      aria-live={
        state === "loading"
          ? "polite"
          : state === "error"
            ? "assertive"
            : undefined
      }
      aria-busy={state === "loading" ? true : undefined}
    />
  );
}
