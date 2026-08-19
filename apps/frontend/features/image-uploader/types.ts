import type { ApiErrorEnvelope, ApiSuccess } from "@/lib/api/types";
import type { ProductImage } from "@/features/catalog/products/types";

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

export type PreparedProductImage =
  | {
      id: number;
      alt_text: string | null;
      is_primary: boolean;
    }
  | {
      storage_key: string;
      alt_text: string | null;
      is_primary: boolean;
    }
  | {
      image_url: string;
      alt_text: string | null;
      is_primary: boolean;
    };

export type ProductImageUploaderHandle = ImageUploaderHandle<void> & {
  /** Uploads new local files once and returns the complete desired gallery. */
  prepare: () => Promise<PreparedProductImage[]>;
  /** Keeps prepared ownerless files alive while an ambiguous save is recoverable. */
  preservePrepared: (preserve: boolean) => void;
  /** Releases rejected prepared files so the next aggregate attempt re-uploads them. */
  discardPrepared: () => void;
  /**
   * Rebases the gallery onto a revision saved by someone else: staged work is
   * kept, rows the other editor deleted are dropped (the server rejects a
   * payload that still references them) and rows they added are adopted.
   */
  rebase: (images: ProductImage[]) => ProductGalleryRebase;
  /** Reconciles local state with the committed aggregate response. */
  commit: (images: ProductImage[]) => void;
};

export type ProductGalleryRebase = {
  /** Images the other editor deleted, removed from the local gallery. */
  dropped: number;
  /** Images the other editor added, taken over into the local gallery. */
  adopted: number;
};

export type UploadImageSuccessEnvelope = ApiSuccess<UploadedImage>;
export type UploadImageErrorEnvelope = ApiErrorEnvelope;
