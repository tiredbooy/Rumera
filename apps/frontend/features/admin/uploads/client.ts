"use client";

import type { ApiFieldErrors } from "@/lib/api/types";
import type {
  UploadedImage,
  OwnerMediaTarget,
  UploadImageErrorEnvelope,
  UploadImageOptions,
  UploadImageSuccessEnvelope,
  UploadProgressCallback,
} from "./types";

export class UploadApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "UploadApiError";
  }
}

type UploadImageEnvelope =
  | UploadImageSuccessEnvelope
  | UploadImageErrorEnvelope;

function parseUploadEnvelope(responseText: string): UploadImageEnvelope | null {
  try {
    return JSON.parse(responseText) as UploadImageEnvelope;
  } catch {
    return null;
  }
}

function upload(
  file: File,
  path: string,
  options: UploadImageOptions = {},
  onProgress?: UploadProgressCallback,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (options.folder) form.append("folder", options.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);

    const rejectAborted = () =>
      reject(new UploadApiError(0, "ABORTED", "بارگذاری لغو شد"));
    const abortUpload = () => xhr.abort();
    const cleanup = () =>
      options.signal?.removeEventListener("abort", abortUpload);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      cleanup();
      const body = parseUploadEnvelope(xhr.responseText);

      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        body &&
        "data" in body &&
        body.data
      ) {
        resolve(body.data);
        return;
      }

      const error = body && "error" in body ? body.error : undefined;
      reject(
        new UploadApiError(
          xhr.status,
          error?.code ?? "UPLOAD_FAILED",
          error?.message ?? "بارگذاری تصویر ناموفق بود",
          error?.fields,
        ),
      );
    };
    xhr.onerror = () => {
      cleanup();
      reject(new UploadApiError(0, "NETWORK", "ارتباط با سرور برقرار نشد"));
    };
    xhr.onabort = () => {
      cleanup();
      rejectAborted();
    };

    if (options.signal?.aborted) {
      rejectAborted();
      return;
    }
    options.signal?.addEventListener("abort", abortUpload, { once: true });

    xhr.send(form);
  });
}

/** Uploads a legacy ownerless image through the authenticated admin BFF. */
export function uploadImage(
  file: File,
  options: UploadImageOptions = {},
  onProgress?: UploadProgressCallback,
): Promise<UploadedImage> {
  return upload(file, "/api/admin/admin/uploads", options, onProgress);
}

/** Uploads and atomically attaches a file to an existing content owner slot. */
export function uploadOwnerImage(
  file: File,
  target: OwnerMediaTarget & { ownerId: number },
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
): Promise<UploadedImage> {
  const ownerType = encodeURIComponent(target.ownerType);
  const role = encodeURIComponent(target.role);
  return upload(
    file,
    `/api/admin/admin/uploads/${ownerType}/${target.ownerId}/${role}`,
    { signal },
    onProgress,
  );
}
