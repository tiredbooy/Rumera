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

export type ProductGallerySnapshot = {
  count: number;
  primaryUrl?: string;
};

export type ProductImageUploaderProps = {
  owner: ProductMediaTarget;
  initialImages?: ProductImage[];
  /** Optional cap on total images (staged + uploaded). Omit for no limit. */
  maxImages?: number;
  /** Keep every gallery edit local until the aggregate product save commits. */
  deferred?: boolean;
  disabled?: boolean;
  /** Reports any gallery difference from the latest committed server state. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Reports the current gallery for form summaries and previews. */
  onGalleryChange?: (gallery: ProductGallerySnapshot) => void;
};
