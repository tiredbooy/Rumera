import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  ),
}));

import { brandCopy, brandMarks } from "@/lib/brand";

import { RumeraBrandMark } from "./rumera-brand-mark";

describe("RumeraBrandMark", () => {
  it("renders a linked full brand with both tone assets and Persian wordmark", () => {
    const html = renderToStaticMarkup(
      <RumeraBrandMark variant="full" size="md" priority />,
    );

    expect(html).toContain(`href="/"`);
    expect(html).toContain(brandCopy.homeAriaLabel);
    expect(html).toContain(brandCopy.wordmarkFa);
    expect(html).toContain(brandMarks.onLight.svg.src);
    expect(html).toContain(brandMarks.onDark.svg.src);
    expect(html).toContain("min-h-11");
    expect(html).toContain("object-contain");
  });

  it("marks decorative instances without naming the brand twice", () => {
    const html = renderToStaticMarkup(
      <RumeraBrandMark variant="mark" decorative href={null} />,
    );

    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain(`href="/"`);
  });

  it("supports wordmark-only and forced dark tone for cellar shells", () => {
    const word = renderToStaticMarkup(
      <RumeraBrandMark variant="wordmark" href="/account" caption="حساب" />,
    );
    expect(word).toContain(brandCopy.wordmarkFa);
    expect(word).toContain("حساب");
    expect(word).not.toContain(brandMarks.onLight.svg.src);

    const dark = renderToStaticMarkup(
      <RumeraBrandMark variant="mark" tone="on-dark" href={null} />,
    );
    expect(dark).toContain(brandMarks.onDark.svg.src);
    // on-light image is present but hidden via class when tone=on-dark
    expect(dark).toContain("hidden");
  });
});
