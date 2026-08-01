"use client";

import { useEffect, useRef } from "react";

export function ResultsHeading({
  id,
  eyebrow,
  title,
  status,
  focusKey,
}: {
  id: string;
  eyebrow: string;
  title: string;
  status: string;
  focusKey: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${id}`) headingRef.current?.focus();
  }, [focusKey, id]);

  return (
    <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2
          ref={headingRef}
          id={id}
          tabIndex={-1}
          className="scroll-mt-28 rounded-sm font-serif text-2xl focus:ring-2 focus:ring-primary focus:ring-offset-4 sm:text-3xl"
        >
          {title}
        </h2>
      </div>
      <p
        className="text-sm leading-7 text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status}
      </p>
    </div>
  );
}
