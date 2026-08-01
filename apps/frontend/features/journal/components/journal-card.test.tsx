import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { JournalListItem } from "@/features/journal/types";
import { JournalCard } from "./journal-card";

const post: JournalListItem = {
  id: 7,
  author_id: 2,
  title: "راهنمای انتخاب",
  slug: "راهنمای-انتخاب",
  excerpt: "خلاصهٔ نوشته",
  image_url: null,
  image_alt: null,
  time_to_read: 6,
  total_reads: 21,
  status: "published",
  is_featured: true,
  published_at: "2026-07-20T10:00:00Z",
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
};

describe("JournalCard", () => {
  it("exposes one focused destination with semantic date and read count", () => {
    const markup = renderToStaticMarkup(
      <JournalCard post={post} headingLevel={3} />,
    );

    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).toContain("<h3");
    expect(markup).toContain('<time dateTime="2026-07-20T10:00:00Z"');
    expect(markup).toContain("بازدید");
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain(
      `href="/journal/${encodeURIComponent(post.slug)}"`,
    );
  });

  it("labels a newest fallback without claiming editorial selection", () => {
    const markup = renderToStaticMarkup(
      <JournalCard post={post} featured featuredLabel="تازه‌ترین نوشته" />,
    );

    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).toContain("تازه‌ترین نوشته");
    expect(markup).not.toContain("نوشتهٔ منتخب");
  });
});
