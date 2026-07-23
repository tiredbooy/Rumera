// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uploadOwnerImage } from "./client";

class FakeXMLHttpRequest {
  static latest: FakeXMLHttpRequest;

  method = "";
  url = "";
  body: Document | XMLHttpRequestBodyInit | null = null;
  status = 201;
  responseText = JSON.stringify({
    data: {
      url: "/media/recipes/19/og-image.webp",
      key: "recipes/19/og-image.webp",
      width: 1200,
      height: 630,
    },
  });
  upload: {
    onprogress: ((event: ProgressEvent) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXMLHttpRequest.latest = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.body = body;
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent);
    this.onload?.();
  }

  abort() {
    this.onabort?.();
  }
}

describe("uploadOwnerImage", () => {
  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the closed owner-aware route and reports progress", async () => {
    const file = new File(["image"], "share.webp", { type: "image/webp" });
    const onProgress = vi.fn();

    const result = await uploadOwnerImage(
      file,
      { ownerType: "recipes", ownerId: 19, role: "og" },
      {},
      onProgress,
    );

    const request = FakeXMLHttpRequest.latest;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/admin/admin/uploads/recipes/19/og");
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("file")).toBe(file);
    expect(onProgress).toHaveBeenCalledWith(0.5);
    expect(result.key).toBe("recipes/19/og-image.webp");
  });

  it("sends explicit alt metadata with owner attachment", async () => {
    const file = new File(["image"], "cover.webp", { type: "image/webp" });

    await uploadOwnerImage(
      file,
      { ownerType: "journal", ownerId: 8, role: "cover" },
      { altText: "Bottle on a table" },
    );

    const body = FakeXMLHttpRequest.latest.body as FormData;
    expect(body.get("alt_text")).toBe("Bottle on a table");
  });
});
