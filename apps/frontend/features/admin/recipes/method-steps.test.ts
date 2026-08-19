// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { extractContentSteps } from "@/lib/content/sanitize-html";

import {
  isEmptyStep,
  joinMethod,
  methodPreservesText,
  splitMethod,
} from "./method-steps";

const htmlOf = (content: string) =>
  splitMethod(content).steps.map((step) => step.html);

describe("recipe method steps", () => {
  it("round-trips a canonical step list without reshaping it", () => {
    const content =
      "<ol><li><p>یخ بریزید</p></li><li><p>هم بزنید</p></li></ol>";
    const split = splitMethod(content);

    expect(split.canonical).toBe(true);
    expect(joinMethod(split)).toBe(content);
    expect(methodPreservesText(content, joinMethod(split))).toBe(true);
  });

  it("keeps a heading and an image outside HowToStep and loses no words", () => {
    const content =
      "<h2>آماده‌سازی</h2><p>یخ بریزید</p>" +
      '<img src="/media/recipes/1/step.webp" alt="" /><p>هم بزنید</p>';
    const split = splitMethod(content);

    expect(split.canonical).toBe(false);
    expect(split.preamble).toContain("<h2>آماده‌سازی</h2>");
    expect(htmlOf(content)).toEqual([
      '<p>یخ بریزید</p><img src="/media/recipes/1/step.webp" alt="">',
      "<p>هم بزنید</p>",
    ]);
    expect(methodPreservesText(content, joinMethod(split))).toBe(true);
    expect(extractContentSteps(joinMethod(split))).toEqual([
      { text: "یخ بریزید", image: "/media/recipes/1/step.webp" },
      { text: "هم بزنید" },
    ]);
  });

  it("does not promote a tips list or an intro paragraph into HowToStep", () => {
    const content =
      "<p>قبل از شروع لیوان را سرد کنید.</p>" +
      "<ol><li>یخ بریزید</li><li>هم بزنید</li></ol>" +
      "<ul><li>با برگ نعنا سرو کنید</li></ul>";
    const split = splitMethod(content);

    expect(split.preamble).toContain("قبل از شروع");
    expect(htmlOf(content)).toEqual(["یخ بریزید", "هم بزنید"]);
    expect(split.appendix).toContain("برگ نعنا");
    expect(methodPreservesText(content, joinMethod(split))).toBe(true);
    expect(extractContentSteps(joinMethod(split))).toEqual([
      { text: "یخ بریزید" },
      { text: "هم بزنید" },
    ]);
  });

  it("explodes an existing list and keeps nested markup inside its step", () => {
    expect(
      htmlOf("<ul><li><p>یک</p><ul><li>ریز</li></ul></li><li>دو</li></ul>"),
    ).toEqual(["<p>یک</p><ul><li>ریز</li></ul>", "دو"]);
  });

  it("keeps prose around a Markdown list and keeps a GFM table", () => {
    const content = [
      "لیوان را سرد کنید.",
      "",
      "1. یخ بریزید",
      "2. هم بزنید",
      "",
      "| پیمانه | مقدار |",
      "| --- | --- |",
      "| یخ | یک پیمانه |",
    ].join("\n");
    const split = splitMethod(content);

    expect(htmlOf(content)).toEqual([
      "<p>یخ بریزید</p>",
      "<p>هم بزنید</p>",
    ]);
    expect(split.preamble).toContain("لیوان را سرد کنید");
    expect(split.appendix).toContain("پیمانه");
    expect(methodPreservesText(content, joinMethod(split))).toBe(true);
    expect(extractContentSteps(joinMethod(split)).map((step) => step.text)).toEqual([
      "یخ بریزید",
      "هم بزنید",
    ]);
  });

  it("reads a bare Markdown list the same way the JSON-LD extractor does", () => {
    expect(htmlOf("1. یخ بریزید\n2. هم بزنید")).toEqual([
      "<p>یخ بریزید</p>",
      "<p>هم بزنید</p>",
    ]);
  });

  it("drops empty steps on serialisation and keeps image-only ones", () => {
    expect(isEmptyStep("<p></p>")).toBe(true);
    expect(isEmptyStep('<img src="/media/a.webp" alt="" />')).toBe(false);
    expect(
      joinMethod([
        { id: "a", html: "<p>یک</p>" },
        { id: "b", html: "<p></p>" },
      ]),
    ).toBe("<ol><li><p>یک</p></li></ol>");
    expect(joinMethod([{ id: "a", html: "<p></p>" }])).toBe("");
  });
});
