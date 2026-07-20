import type { ProductImage } from "../catalog/products/types";

export type SlotStatus = "idle" | "uploading" | "error";

export type StagedSlot = {
  kind: "staged";
  localId: string;
  source: { kind: "file"; file: File } | { kind: "url"; url: string };
  previewUrl: string;
  alt: string;
  isPrimary: boolean;
  status: SlotStatus;
  progress: number;
  error?: string;
  validationError?: boolean;
};

export type UploadedSlot = {
  kind: "uploaded";
  localId: string;
  image: ProductImage;
  alt: string;
};

export type Slot = StagedSlot | UploadedSlot;

export type ImageUploaderHandle = {
  hasStaged: boolean;
  /** Resolves only after every staged image and ordering change is durable. */
  flush: (productId: number) => Promise<void>;
};

export type ImageUploaderProps = {
  productId?: number | null;
  initialImages?: ProductImage[];
  /** Optional cap on total images (staged + uploaded). Omit for no limit. */
  maxImages?: number;
};
