import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

import {
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  previewDisplayUrl,
  seoDocumentTitle,
  seoSnippetDescription,
  truncateSeo,
} from "./seo-preview";

export function SeoCharCount({
  value,
  limit,
}: {
  value: string;
  limit: number;
}) {
  const count = value.trim().length;
  const over = count > limit;
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        over ? "text-warning" : "text-muted-foreground",
      )}
    >
      {faNum(count)} / {faNum(limit)}
      {over ? " — در نتایج گوگل کوتاه می‌شود" : null}
    </p>
  );
}

export function SearchSnippetPreview({
  metaTitle,
  fallbackTitle,
  metaDescription,
  descriptionFallbacks,
  path,
}: {
  metaTitle: string;
  fallbackTitle: string;
  metaDescription: string;
  descriptionFallbacks: Array<string | null | undefined>;
  path: string;
}) {
  const title = truncateSeo(
    seoDocumentTitle(metaTitle, fallbackTitle),
    SEO_TITLE_LIMIT,
  );
  const description = truncateSeo(
    seoSnippetDescription(metaDescription, ...descriptionFallbacks),
    SEO_DESCRIPTION_LIMIT,
  );
  const usingTitleFallback = !metaTitle.trim();
  const usingDescriptionFallback = !metaDescription.trim();

  return (
    <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-border/60">
      <p className="text-xs text-muted-foreground">پیش‌نمایش نتیجهٔ گوگل</p>
      <p className="mt-2 truncate text-sm text-[#202124] dark:text-foreground">
        {previewDisplayUrl(path)}
      </p>
      {/* Google snippet chrome — keep the SERP blue, not a status token. */}
      <p className="mt-0.5 truncate text-xl leading-7 text-[#1a0dab] dark:text-sky-400">
        {title}
      </p>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#4d5156] dark:text-muted-foreground">
        {description || "توضیحی برای نمایش در گوگل وجود ندارد."}
      </p>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        <li>
          عنوان خالی: از{" "}
          <span className="text-foreground">
            {usingTitleFallback ? "عنوان صفحه" : "عنوان سئو"}
          </span>{" "}
          استفاده می‌شود.
        </li>
        <li>
          توضیح خالی: از{" "}
          <span className="text-foreground">
            {usingDescriptionFallback ? "خلاصه / توضیح صفحه" : "توضیح سئو"}
          </span>{" "}
          استفاده می‌شود.
        </li>
      </ul>
    </div>
  );
}

export { SEO_DESCRIPTION_LIMIT, SEO_TITLE_LIMIT };
