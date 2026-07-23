import type { ApiErrorEnvelope, ApiSuccess } from "@/lib/api/types";

export type ProductMediaTarget = {
  ownerType: "products";
  role: "gallery";
  ownerId?: number | null;
};

export type ContentMediaTarget =
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

export type MediaTarget = ProductMediaTarget | ContentMediaTarget;

export type ImageSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string };

/** Canonical result returned by owner-aware and legacy single-image uploads. */
export interface UploadedImage {
  url: string;
  key: string;
  width: number;
  height: number;
}

export interface UploadImageOptions {
  folder?: string;
  altText?: string;
  signal?: AbortSignal;
}

export type UploadProgressCallback = (fraction: number) => void;

/** Shared save boundary used by gallery and fixed-role media controls. */
export type ImageUploaderHandle<TResult = void> = {
  readonly hasStaged: boolean;
  readonly isBusy: boolean;
  validate: () => string | null;
  /** Resolves only after all staged media changes are durable. */
  flush: (ownerId?: number) => Promise<TResult>;
};

export type UploadImageSuccessEnvelope = ApiSuccess<UploadedImage>;
export type UploadImageErrorEnvelope = ApiErrorEnvelope;
