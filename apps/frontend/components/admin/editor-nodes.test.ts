// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@/lib/content/sanitize-html";

import { EditorImage, EditorTable } from "./editor-nodes";

function roundTrip(html: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      EditorImage,
      EditorTable,
    ],
    content: html,
  });
  const result = editor.getHTML();
  editor.destroy();
  return result;
}

describe("editorial editor nodes", () => {
  it("round-trips an image through markup the renderer keeps", () => {
    const html = roundTrip(
      '<p>متن</p><img src="/media/uploads/a.webp" alt="بطری">',
    );

    expect(html).toContain('<img src="/media/uploads/a.webp" alt="بطری">');
    expect(sanitizeHtml(html)).toContain(
      '<img src="/media/uploads/a.webp" alt="بطری" />',
    );
  });

  it("round-trips a table and keeps every cell through the sanitizer", () => {
    const html = roundTrip(
      "<table><thead><tr><th>سال</th><th>امتیاز</th></tr></thead>" +
        "<tbody><tr><td>۱۴۰۲</td><td>۹۲</td></tr></tbody></table>",
    );

    const safe = sanitizeHtml(html);
    expect(safe).toContain("<th>سال</th>");
    expect(safe).toContain("<td>۱۴۰۲</td>");
    expect(safe).toContain("<td>۹۲</td>");
  });

  it("keeps a product mention as a link the renderer can follow", () => {
    const safe = sanitizeHtml(
      roundTrip('<p><a href="/products/negroni">نگرونی</a></p>'),
    );

    expect(safe).toContain('href="/products/negroni"');
    expect(safe).toContain("نگرونی");
  });
});
