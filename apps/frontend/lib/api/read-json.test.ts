import { describe, expect, it, vi } from "vitest";

import { readJsonOrNull } from "./read-json";

describe("readJsonOrNull", () => {
  it("does not call json() on 304 or 204", async () => {
    const json = vi.fn();
    await expect(
      readJsonOrNull({ status: 304, json } as unknown as Response),
    ).resolves.toBeNull();
    await expect(
      readJsonOrNull({ status: 204, json } as unknown as Response),
    ).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("returns parsed JSON on 200 and null when parse fails", async () => {
    await expect(
      readJsonOrNull({
        status: 200,
        json: () => Promise.resolve({ data: 1 }),
      } as unknown as Response),
    ).resolves.toEqual({ data: 1 });
    await expect(
      readJsonOrNull({
        status: 200,
        json: () => Promise.reject(new SyntaxError("empty")),
      } as unknown as Response),
    ).resolves.toBeNull();
  });
});
