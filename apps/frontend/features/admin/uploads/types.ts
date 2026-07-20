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

export type OwnerMediaTarget =
  | {
      ownerType: "hero-slides";
      role: "desktop" | "mobile";
      ownerId?: number | null;
    }
  | {
      ownerType: "recipes";
      role: "cover" | "og";
      ownerId?: number | null;
    }
  | {
      ownerType: "journal";
      role: "cover";
      ownerId?: number | null;
    };

export interface FlexibleImageInputHandle {
  hasStaged: boolean;
  flush: (ownerId?: number) => Promise<UploadedImage | null>;
}

export type UploadProgressCallback = (fraction: number) => void;

export type UploadImageSuccessEnvelope = ApiSuccess<UploadedImage>;
export type UploadImageErrorEnvelope = ApiErrorEnvelope;
