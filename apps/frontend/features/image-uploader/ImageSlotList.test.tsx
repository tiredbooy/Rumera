// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageSlotList } from "./ImageSlotList";
import type { Slot, StagedSlot } from "./product-types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function stagedSlot(localId: string, alt: string): StagedSlot {
  return {
    kind: "staged",
    localId,
    source: {
      kind: "file",
      file: new File([alt], `${localId}.jpg`, { type: "image/jpeg" }),
    },
    previewUrl: `blob:${localId}`,
    alt,
    isPrimary: false,
    status: "idle",
    progress: 0,
  };
}

function ReorderHarness({
  persist = false,
  rollback = false,
  count = 2,
}: {
  persist?: boolean;
  rollback?: boolean;
  count?: number;
}) {
  const seeds = ["first", "second", "third", "fourth"] as const;
  const alts = ["اول", "دوم", "سوم", "چهارم"] as const;
  const [slots, setSlots] = React.useState<Slot[]>(
    Array.from({ length: count }, (_, index) =>
      stagedSlot(seeds[index], alts[index]),
    ),
  );
  const [isPending, setIsPending] = React.useState(false);

  function move(from: number, to: number) {
    setSlots((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <ImageSlotList
      slots={slots}
      isPending={isPending}
      live={persist}
      onAltChange={vi.fn()}
      onAltCommit={vi.fn()}
      onMakePrimary={vi.fn()}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onMove={move}
      onMoveUp={(index) => move(index, index - 1)}
      onMoveDown={(index) => {
        move(index, index + 1);
        if (persist) {
          setIsPending(true);
          window.setTimeout(() => {
            if (rollback) move(index + 1, index);
            setIsPending(false);
          }, 10);
        }
      }}
    />
  );
}

describe("ImageSlotList keyboard reordering", () => {
  it("moves an image with native controls and keeps focus on the moved item", () => {
    render(<ReorderHarness />);

    const moveDown = screen.getByRole("button", {
      name: "انتقال تصویر 1 از 2 به جایگاه بعدی",
    });
    moveDown.focus();
    fireEvent.click(moveDown);

    expect(
      screen
        .getAllByRole("textbox")
        .map((input) => input.getAttribute("value")),
    ).toEqual(["دوم", "اول"]);

    const movedControl = screen.getByRole("button", {
      name: "انتقال تصویر 2 از 2 به جایگاه قبلی",
    });
    expect(movedControl).toHaveFocus();
    expect(movedControl).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "انتقال تصویر 2 از 2 به جایگاه بعدی",
      }),
    ).toBeDisabled();
    expect(movedControl.className).toContain(
      "[@media(any-pointer:coarse)]:min-h-11",
    );
  });

  it("restores focus after a persisted reorder finishes", async () => {
    vi.useFakeTimers();
    render(<ReorderHarness persist />);

    const moveDown = screen.getByRole("button", {
      name: "انتقال تصویر 1 از 2 به جایگاه بعدی",
    });
    moveDown.focus();
    fireEvent.click(moveDown);

    const movedControl = screen.getByRole("button", {
      name: "انتقال تصویر 2 از 2 به جایگاه قبلی",
    });
    expect(movedControl).toBeDisabled();
    expect(movedControl).not.toHaveFocus();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(movedControl).toBeEnabled();
    expect(movedControl).toHaveFocus();
  });

  it("keeps focus on the same-direction control so a second keypress continues", () => {
    render(<ReorderHarness count={3} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "انتقال تصویر 1 از 3 به جایگاه بعدی",
      }),
    );

    expect(
      screen
        .getAllByRole("textbox")
        .map((input) => input.getAttribute("value")),
    ).toEqual(["دوم", "اول", "سوم"]);

    const continueNext = screen.getByRole("button", {
      name: "انتقال تصویر 2 از 3 به جایگاه بعدی",
    });
    expect(continueNext).toHaveFocus();

    fireEvent.click(continueNext);

    expect(
      screen
        .getAllByRole("textbox")
        .map((input) => input.getAttribute("value")),
    ).toEqual(["دوم", "سوم", "اول"]);
  });

  it("writes a drag payload so Firefox will start the drag", () => {
    render(<ReorderHarness />);

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(screen.getAllByRole("listitem")[0], { dataTransfer });

    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "first");
  });

  it("restores focus to a valid control when persistence rolls back", async () => {
    vi.useFakeTimers();
    render(<ReorderHarness persist rollback />);

    const moveDown = screen.getByRole("button", {
      name: "انتقال تصویر 1 از 2 به جایگاه بعدی",
    });
    moveDown.focus();
    fireEvent.click(moveDown);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(
      screen
        .getAllByRole("textbox")
        .map((input) => input.getAttribute("value")),
    ).toEqual(["اول", "دوم"]);
    expect(
      screen.getByRole("button", {
        name: "انتقال تصویر 1 از 2 به جایگاه بعدی",
      }),
    ).toHaveFocus();
  });
});
