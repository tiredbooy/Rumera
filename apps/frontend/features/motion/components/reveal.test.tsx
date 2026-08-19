// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "./reveal";

afterEach(cleanup);

describe("Reveal", () => {
  it("reveals once when the node intersects and never imports motion", async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: IntersectionObserverCallback = () => {};

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    render(
      <Reveal delay={0.1} y={20} className="extra">
        محتوا
      </Reveal>,
    );

    const node = screen.getByText("محتوا");
    expect(node).toHaveClass("reveal", "extra");
    expect(node).not.toHaveClass("reveal-visible");
    expect(node.style.getPropertyValue("--reveal-delay")).toBe("0.1s");
    expect(node.style.getPropertyValue("--reveal-y")).toBe("20px");
    expect(observe).toHaveBeenCalledTimes(1);

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      { disconnect } as unknown as IntersectionObserver,
    );

    expect(await screen.findByText("محتوا")).toHaveClass("reveal-visible");
    expect(disconnect).toHaveBeenCalled();
  });
});
