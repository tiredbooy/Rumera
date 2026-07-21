"use client";

import { useEffect, useRef } from "react";

export function CategoryResultsHeading({
  id,
  title,
  status,
  focusKey,
}: {
  id: string;
  title: string;
  status: string;
  focusKey: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      headingRef.current?.focus();
    }
  }, [focusKey, id]);

  return (
    <>
      <div>
        <p className="eyebrow mb-2">انتخاب‌های سردابه</p>
        <h2
          ref={headingRef}
          id={id}
          tabIndex={-1}
          className="scroll-mt-24 rounded-sm font-serif text-2xl outline-none focus:ring-2 focus:ring-primary focus:ring-offset-4 sm:text-3xl"
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
    </>
  );
}
