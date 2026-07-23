import type { ProductImage } from "@/features/catalog/products/types";
import type {
  ImageSource,
  ProductMediaTarget,
} from "@/features/image-uploader/types";

export type SlotStatus = "idle" | "uploading" | "error";

export type StagedSlot = {
  kind: "staged";
  localId: string;
  source: ImageSource;
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

export type ProductImageUploaderProps = {
  owner: ProductMediaTarget;
  initialImages?: ProductImage[];
  /** Optional cap on total images (staged + uploaded). Omit for no limit. */
  maxImages?: number;
  disabled?: boolean;
};
