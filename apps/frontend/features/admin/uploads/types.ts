import type { ApiErrorEnvelope, ApiSuccess } from "@/lib/api/types";

/** Standalone image metadata returned by POST /admin/uploads. */
export interface UploadedImage {
  url: string;
  key: string;
  width: number;
  height: number;
}

export interface UploadImageOptions {
  folder?: string;
  signal?: AbortSignal;
}

export type UploadProgressCallback = (fraction: number) => void;

export type UploadImageSuccessEnvelope = ApiSuccess<UploadedImage>;
export type UploadImageErrorEnvelope = ApiErrorEnvelope;
