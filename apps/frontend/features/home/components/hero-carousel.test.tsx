// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicHeroSlide } from "@/features/hero-slides/types";

const embla = vi.hoisted(() => {
  let selected = 0;
  const listeners = new Map<string, () => void>();
  const api = {
    selectedScrollSnap: vi.fn(() => selected),
    on: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, listener);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    scrollTo: vi.fn((index: number) => {
      selected = index;
      listeners.get("select")?.();
    }),
    scrollPrev: vi.fn(() => {
      selected -= 1;
      listeners.get("select")?.();
    }),
    scrollNext: vi.fn(() => {
      selected += 1;
      listeners.get("select")?.();
    }),
  };

  return {
    api,
    ref: vi.fn(),
    reset() {
      selected = 0;
      listeners.clear();
      Object.values(api).forEach((value) => {
        if (typeof value === "function" && "mockClear" in value)
          value.mockClear();
      });
    },
  };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [embla.ref, embla.api],
}));

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

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

import { HeroCarousel } from "./hero-carousel";

function slide(id: number, title: string): PublicHeroSlide {
  return {
    id,
    eyebrow: null,
    title,
    subtitle: null,
    badge: null,
    image_url: `/hero-${id}.jpg`,
    mobile_image_url: null,
    image_alt: title,
    cta_label: `خرید ${title}`,
    cta_href: `/products/${id}`,
    secondary_cta_label: null,
    secondary_cta_href: null,
    theme: "dark",
    sort_order: id,
  };
}

beforeEach(() => {
  embla.reset();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HeroCarousel focus management", () => {
  it("keeps only the selected slide interactive", () => {
    const reducedMotionInterval = vi.spyOn(window, "setInterval");
    const secondSlide = { ...slide(2, "دوم"), theme: "light" as const };
    render(<HeroCarousel slides={[slide(1, "اول"), secondSlide]} />);

    const first = screen
      .getByText("اول")
      .closest('[aria-roledescription="اسلاید"]');
    const second = screen
      .getByText("دوم")
      .closest('[aria-roledescription="اسلاید"]');

    expect(first).not.toHaveAttribute("inert");
    expect(first).not.toHaveAttribute("aria-hidden");
    expect(second).toHaveAttribute("inert");
    expect(second).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveTextContent("خرید اول");
    expect(
      screen.getByRole("region", { name: "پیشنهادهای ویژه" }),
    ).toHaveAttribute("data-theme", "dark");
    expect(reducedMotionInterval).not.toHaveBeenCalled();

    const secondDot = screen.getByRole("button", {
      name: "نمایش اسلاید 2: دوم",
    });
    expect(secondDot).toHaveClass("size-11");
    expect(secondDot.className).toContain("focus-visible:ring-3");
    fireEvent.click(secondDot);

    expect(first).toHaveAttribute("inert");
    expect(second).not.toHaveAttribute("inert");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveTextContent("خرید دوم");
    expect(
      screen.getByRole("region", { name: "پیشنهادهای ویژه" }),
    ).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "اسلاید قبلی" })).toHaveClass(
      "size-11",
    );
    reducedMotionInterval.mockRestore();
  });

  it("uses mobile art direction and keeps slide titles below the page heading", () => {
    const item = {
      ...slide(1, "اول"),
      mobile_image_url: "/hero-1-mobile.jpg",
      badge: "ویژه",
      theme: "light" as const,
    };
    const { container } = render(<HeroCarousel slides={[item]} />);

    const source = container.querySelector(
      'source[media="(min-width: 640px)"]',
    );
    expect(source?.getAttribute("srcset")).toContain("hero-1.jpg");
    expect(screen.getByRole("img", { name: "اول" })).toHaveAttribute(
      "srcset",
      expect.stringContaining("hero-1-mobile.jpg"),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "اول" }),
    ).toBeVisible();
    expect(screen.getByText("ویژه")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(container.querySelector(".touch-pan-y")).toBeInTheDocument();
  });

  it("falls back from a broken mobile image before showing the placeholder", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
      })),
    });
    const { container } = render(
      <HeroCarousel
        slides={[
          {
            ...slide(1, "اول"),
            mobile_image_url: "/hero-1-mobile.jpg",
          },
        ]}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "اول" }));
    expect(screen.getByRole("img", { name: "اول" })).toHaveAttribute(
      "srcset",
      expect.stringContaining("hero-1.jpg"),
    );

    fireEvent.error(screen.getByRole("img", { name: "اول" }));
    expect(container.querySelector("picture")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "اول" })).toBeVisible();
  });

  it("autoplays until persistently paused and stays paused through pointer leave", () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    render(<HeroCarousel slides={[slide(1, "اول"), slide(2, "دوم")]} />);

    act(() => vi.advanceTimersByTime(6500));
    expect(embla.api.scrollNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "توقف پخش خودکار" }));
    embla.api.scrollNext.mockClear();
    act(() => vi.advanceTimersByTime(6500));
    expect(embla.api.scrollNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "شروع پخش خودکار" }));
    const carousel = screen.getByRole("region", { name: "پیشنهادهای ویژه" });
    fireEvent.pointerDown(carousel);
    fireEvent.pointerLeave(carousel);
    act(() => vi.advanceTimersByTime(6500));
    expect(embla.api.scrollNext).not.toHaveBeenCalled();

    fireEvent.pointerUp(window);
    act(() => vi.advanceTimersByTime(6500));
    expect(embla.api.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("contains many 44px slide targets without widening the viewport", () => {
    const slides = Array.from({ length: 7 }, (_, index) =>
      slide(index + 1, `اسلاید ${index + 1}`),
    );
    render(<HeroCarousel slides={slides} />);

    const controls = screen.getByRole("group", { name: "انتخاب اسلاید" });
    expect(controls).toHaveClass("min-w-0", "max-w-full", "overflow-x-auto");
    const scrollBy = vi.fn();
    Object.defineProperties(controls, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, right: 280 }) as DOMRect,
      },
      scrollBy: { configurable: true, value: scrollBy },
    });
    const seventh = screen.getByRole("button", {
      name: "نمایش اسلاید 7: اسلاید 7",
    });
    Object.defineProperty(seventh, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: -28, right: 16 }) as DOMRect,
    });

    const next = screen.getByRole("button", { name: "اسلاید بعدی" });
    for (let index = 0; index < 6; index += 1) fireEvent.click(next);

    expect(seventh).toHaveClass("size-11", "shrink-0");
    expect(seventh).toHaveAttribute("aria-current", "true");
    expect(scrollBy).toHaveBeenCalledWith({ left: -28 });
  });
});
