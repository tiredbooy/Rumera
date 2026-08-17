import { Wrench } from "lucide-react";

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";

/** Full-page storefront stand-in — no shopping chrome or page content. */
export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="cellar-glow flex min-h-dvh flex-1 flex-col items-center justify-center px-5 py-14 [padding-bottom:max(3.5rem,env(safe-area-inset-bottom))] [padding-top:max(2rem,env(safe-area-inset-top))]"
    >
      <RumeraBrandMark variant="full" size="lg" href={null} />

      <div className="border-hairline shadow-e3 mt-10 w-full max-w-md rounded-3xl bg-card/90 p-7 text-center ring-1 ring-foreground/5 sm:p-9">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Wrench className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 font-serif text-3xl leading-snug whitespace-pre-wrap sm:text-4xl">
          {message}
        </h1>
      </div>
    </main>
  );
}
