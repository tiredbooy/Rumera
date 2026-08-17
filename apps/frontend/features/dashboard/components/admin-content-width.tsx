"use client";

import * as React from "react";

export type AdminContentWidth = "default" | "wide";

const AdminContentWidthContext = React.createContext<{
  setWidth: (width: AdminContentWidth) => void;
} | null>(null);

export function AdminContentWidthProvider({
  children,
  onWidthChange,
}: {
  children: React.ReactNode;
  onWidthChange: (width: AdminContentWidth) => void;
}) {
  const value = React.useMemo(
    () => ({ setWidth: onWidthChange }),
    [onWidthChange],
  );
  return (
    <AdminContentWidthContext.Provider value={value}>
      {children}
    </AdminContentWidthContext.Provider>
  );
}

/** Mounted by AdminPage so list routes can drop the 78rem form cap. */
export function AdminPageWidth({ width }: { width: AdminContentWidth }) {
  const ctx = React.useContext(AdminContentWidthContext);
  React.useLayoutEffect(() => {
    ctx?.setWidth(width);
    return () => ctx?.setWidth("default");
  }, [ctx, width]);
  return null;
}
