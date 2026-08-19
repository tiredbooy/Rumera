// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));

vi.mock("@/features/admin/shared/upload-owner-media", () => ({
  uploadOwnerMedia: mocks.upload,
}));

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ src }: { src: string | null }) => (
    <span data-testid="preview" data-src={src ?? ""} />
  ),
}));

import { JournalOGImage } from "./journal-og-image";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function pngFile() {
  return new File([new Uint8Array([1, 2, 3])], "og.png", { type: "image/png" });
}

describe("journal OG image", () => {
  it("falls back to the cover preview until an OG image is set", () => {
    render(
      <JournalOGImage
        postId={4}
        value=""
        onChange={vi.fn()}
        fallbackURL="/media/journal/4/cover.webp"
      />,
    );
    expect(screen.getByTestId("preview")).toHaveAttribute(
      "data-src",
      "/media/journal/4/cover.webp",
    );
  });

  it("attaches an uploaded file to the post's OG slot", async () => {
    mocks.upload.mockResolvedValue({
      url: "/media/journal/4/og-x.webp",
      key: "k",
    });
    const onChange = vi.fn();
    const { container } = render(
      <JournalOGImage postId={4} value="" onChange={onChange} />,
    );

    const input = container.querySelector<HTMLInputElement>("#og_image_file");
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [pngFile()] },
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("/media/journal/4/og-x.webp"),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      "journal",
      4,
      "og",
      expect.any(File),
    );
  });

  it("cannot upload before the post exists — the slot needs an owner row", () => {
    render(<JournalOGImage value="" onChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /بارگذاری فایل/ }),
    ).toBeDisabled();
    expect(
      screen.getByText("برای بارگذاری فایل، ابتدا نوشته را ذخیره کنید."),
    ).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
