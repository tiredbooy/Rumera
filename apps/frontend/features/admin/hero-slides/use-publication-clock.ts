"use client";

import * as React from "react";

const PUBLICATION_CLOCK_INTERVAL_MS = 30_000;

export function usePublicationClock(): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      PUBLICATION_CLOCK_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
