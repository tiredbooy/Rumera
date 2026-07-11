import { ImageResponse } from "../catalog/products/types";

export type SlotStatus = "idle" | "uploading" | "error";

export type StagedSlot = {
  kind: "staged";
  localId: string;
  file: File;
  previewUrl: string;
  alt: string;
  isPrimary: boolean;
  status: SlotStatus;
  progress: number;
  error?: string;
};

export type UploadedSlot = {
  kind: "uploaded";
  localId: string;
  image: ImageResponse;
  alt: string;
};

export type Slot = StagedSlot | UploadedSlot;

export type ImageUploaderHandle = {
  hasStaged: boolean;
  /** Upload every staged file (in display order) against `productId`. */
  flush: (productId: number) => Promise<void>;
};

export type ImageUploaderProps = {
  productId?: number | null;
  initialImages?: ImageResponse[];
  /** Optional cap on total images (staged + uploaded). Omit for no limit. */
  maxImages?: number;
};
