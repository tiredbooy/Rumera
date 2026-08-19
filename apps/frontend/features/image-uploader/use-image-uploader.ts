"use client";

import * as React from "react";
import {
  addProductImageURL,
  uploadProductImage,
} from "../admin/products/api/client";
import { releaseUpload, uploadImage as uploadStandaloneImage } from "./client";
import {
  deleteProductImage,
  reorderProductImages,
  setPrimaryImage,
  updateImageAlt,
} from "../admin/products/actions/images";
import {
  isSameFile,
  MAX_IMAGE_ALT_LENGTH,
  validateImageURL,
  validateFile,
} from "./constants";
import type { ProductImage } from "../catalog/products/types";
import type {
  PreparedProductImage,
  ProductGalleryRebase,
  UploadedImage,
} from "./types";
import type {
  ProductImageUploaderProps,
  Slot,
  StagedSlot,
  UploadedSlot,
} from "./product-types";

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

/**
 * Storefront order. Every read path — the product detail query, the cart join,
 * the review and recipe joins — sorts `is_primary DESC, sort_order ASC`, so
 * this is the order a customer actually sees.
 */
function galleryOrder(left: ProductImage, right: ProductImage) {
  return (
    Number(right.is_primary) - Number(left.is_primary) ||
    left.sort_order - right.sort_order
  );
}

/**
 * One notion of "the main image" (PE-8): the first slot is the cover, and
 * `is_primary` is only how that is persisted.
 *
 * There used to be two. The star set `is_primary`, which is what the aggregate
 * save sends and what every read path orders by; the list position set
 * `sort_order`, which is only the tiebreak. Nothing kept them in step, so
 * reordering the gallery moved the cover nowhere and the editor showed an order
 * the storefront never used. Collapsing them means a move *is* the cover
 * change, and `normalizeGallery` is the single place that says so.
 */
function normalizeGallery(slots: Slot[]): Slot[] {
  return slots.map((slot, index) => {
    const primary = index === 0;
    if (slot.kind === "uploaded") {
      return slot.image.is_primary === primary
        ? slot
        : { ...slot, image: { ...slot.image, is_primary: primary } };
    }
    return slot.isPrimary === primary ? slot : { ...slot, isPrimary: primary };
  });
}

function gallerySignature(slots: Slot[]) {
  return JSON.stringify(
    slots.map((slot) =>
      slot.kind === "uploaded"
        ? ["uploaded", slot.image.id, slot.alt, slot.image.is_primary]
        : [
            "staged",
            slot.localId,
            slot.source.kind,
            slot.source.kind === "url"
              ? slot.source.url
              : [
                  slot.source.file.name,
                  slot.source.file.size,
                  slot.source.file.lastModified,
                ],
            slot.alt,
            slot.isPrimary,
          ],
    ),
  );
}

export function useImageUploader({
  owner,
  initialImages = [],
  maxImages,
  deferred = false,
  disabled = false,
  onDirtyChange,
  onGalleryChange,
}: ProductImageUploaderProps) {
  const productId = owner.ownerId;
  const live = !deferred && typeof productId === "number" && productId > 0;
  const idRef = React.useRef(0);
  const initialSlots = React.useMemo<Slot[]>(
    () =>
      normalizeGallery(
        initialImages
          .slice()
          .sort(galleryOrder)
          .map((image) => ({
            kind: "uploaded",
            localId: `init-${image.id}`,
            image,
            alt: image.alt_text ?? "",
          })),
      ),
    [initialImages],
  );
  const [slots, setSlots] = React.useState<Slot[]>(initialSlots);
  const slotsRef = React.useRef(slots);
  const [cleanSignature, setCleanSignature] = React.useState(() =>
    gallerySignature(initialSlots),
  );
  const disposedRef = React.useRef(false);
  const preservePreparedRef = React.useRef(false);
  const objectUrlsRef = React.useRef(new Set<string>());
  const inFlightUploadsRef = React.useRef(
    new Map<string, Promise<ProductImage>>(),
  );
  const preparedUploadsRef = React.useRef(new Map<string, UploadedImage>());
  const inFlightPreparationsRef = React.useRef(
    new Map<string, Promise<UploadedImage>>(),
  );
  const pendingPersistenceRef = React.useRef(new Set<Promise<void>>());
  const persistenceErrorRef = React.useRef<Error | null>(null);
  const flushingRef = React.useRef(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isFlushing, setIsFlushing] = React.useState(false);
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const isDirty = gallerySignature(slots) !== cleanSignature;

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  React.useEffect(() => {
    const cover = slots[0];
    onGalleryChange?.({
      count: slots.length,
      primaryUrl:
        cover?.kind === "uploaded" ? cover.image.image_url : cover?.previewUrl,
    });
  }, [onGalleryChange, slots]);

  const announce = React.useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const replaceSlots = React.useCallback(
    (update: (current: Slot[]) => Slot[]) => {
      const next = normalizeGallery(update(slotsRef.current));
      slotsRef.current = next;
      setSlots(next);
    },
    [],
  );

  const revokePreview = React.useCallback((url: string) => {
    if (!objectUrlsRef.current.delete(url)) return;
    URL.revokeObjectURL(url);
  }, []);

  React.useEffect(() => {
    disposedRef.current = false;
    const objectUrls = objectUrlsRef.current;
    const preparedUploads = preparedUploadsRef.current;
    return () => {
      disposedRef.current = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
      if (!preservePreparedRef.current) {
        preparedUploads.forEach((upload) => {
          void releaseUpload(upload.key).catch(() => {
            // Referenced files are retained; reconciliation handles failed release.
          });
        });
      }
      preparedUploads.clear();
    };
  }, []);

  const releasePreparedSlot = React.useCallback((localId: string) => {
    const prepared = preparedUploadsRef.current.get(localId);
    if (!prepared) return;
    preparedUploadsRef.current.delete(localId);
    void releaseUpload(prepared.key).catch(() => {
      // Reconciliation is the durable fallback for failed best-effort release.
    });
  }, []);

  const patchStaged = React.useCallback(
    (localId: string, next: Partial<StagedSlot>) => {
      if (disposedRef.current) return;
      replaceSlots((current) =>
        current.map((slot) =>
          slot.localId === localId && slot.kind === "staged"
            ? { ...slot, ...next }
            : slot,
        ),
      );
    },
    [replaceSlots],
  );

  const trackPersistence = React.useCallback((operation: Promise<void>) => {
    pendingPersistenceRef.current.add(operation);
    setPendingCount((count) => count + 1);
    void operation.finally(() => {
      pendingPersistenceRef.current.delete(operation);
      setPendingCount((count) => Math.max(0, count - 1));
    });
  }, []);

  const waitForPersistence = React.useCallback(async () => {
    while (pendingPersistenceRef.current.size > 0) {
      await Promise.all(Array.from(pendingPersistenceRef.current));
    }
    if (persistenceErrorRef.current) {
      const error = persistenceErrorRef.current;
      persistenceErrorRef.current = null;
      throw error;
    }
  }, []);

  const uploadStaged = React.useCallback(
    (slot: StagedSlot, pid: number): Promise<ProductImage> => {
      const existing = inFlightUploadsRef.current.get(slot.localId);
      if (existing) return existing;

      const operation = (async () => {
        patchStaged(slot.localId, {
          status: "uploading",
          progress: 0,
          error: undefined,
        });
        try {
          const image =
            slot.source.kind === "file"
              ? await uploadProductImage(
                  pid,
                  slot.source.file,
                  {
                    altText: slot.alt || undefined,
                    isPrimary: slot.isPrimary,
                  },
                  (progress) => patchStaged(slot.localId, { progress }),
                )
              : await addProductImageURL(pid, slot.source.url, {
                  altText: slot.alt || undefined,
                  isPrimary: slot.isPrimary,
                });
          revokePreview(slot.previewUrl);
          replaceSlots((current) =>
            current.map((currentSlot) => {
              if (currentSlot.localId === slot.localId) {
                return {
                  kind: "uploaded",
                  localId: currentSlot.localId,
                  image,
                  alt: image.alt_text ?? "",
                };
              }
              if (!image.is_primary) return currentSlot;
              return currentSlot.kind === "uploaded"
                ? {
                    ...currentSlot,
                    image: { ...currentSlot.image, is_primary: false },
                  }
                : { ...currentSlot, isPrimary: false };
            }),
          );
          return image;
        } catch (error) {
          const uploadError = asError(error, "بارگذاری ناموفق بود");
          patchStaged(slot.localId, {
            status: "error",
            error: uploadError.message,
          });
          throw uploadError;
        } finally {
          inFlightUploadsRef.current.delete(slot.localId);
        }
      })();

      inFlightUploadsRef.current.set(slot.localId, operation);
      return operation;
    },
    [patchStaged, replaceSlots, revokePreview],
  );

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      if (
        disabled ||
        flushingRef.current ||
        pendingPersistenceRef.current.size > 0 ||
        inFlightUploadsRef.current.size > 0
      ) {
        return;
      }
      setLimitMessage(null);
      const current = slotsRef.current;
      const existingFiles = current
        .filter(
          (
            slot,
          ): slot is StagedSlot & { source: { kind: "file"; file: File } } =>
            slot.kind === "staged" && slot.source.kind === "file",
        )
        .map((slot) => slot.source.file);
      const room =
        typeof maxImages === "number"
          ? Math.max(0, maxImages - current.length)
          : Infinity;

      if (room === 0) {
        setLimitMessage(`حداکثر ${maxImages} تصویر مجاز است.`);
        return;
      }

      const unique: File[] = [];
      for (const file of Array.from(files)) {
        if (
          existingFiles.some((existing) => isSameFile(existing, file)) ||
          unique.some((existing) => isSameFile(existing, file))
        ) {
          continue;
        }
        unique.push(file);
      }
      const accepted = unique.slice(0, room);
      if (accepted.length < Array.from(files).length) {
        setLimitMessage(
          accepted.length < unique.length
            ? `فقط ${accepted.length} تصویر اضافه شد؛ حداکثر ${maxImages} تصویر مجاز است.`
            : "برخی تصاویر تکراری بودند و نادیده گرفته شدند.",
        );
      }

      const incoming: StagedSlot[] = accepted.map((file) => {
        const error = validateFile(file);
        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);
        return {
          kind: "staged",
          localId: `slot-${idRef.current++}`,
          source: { kind: "file", file },
          previewUrl,
          alt: "",
          isPrimary: false,
          status: error ? "error" : "idle",
          progress: 0,
          error: error ?? undefined,
          validationError: Boolean(error),
        };
      });

      // normalizeGallery owns the cover; this only keeps the flag a live
      // upload carries with it in step with where the slot lands.
      if (current.length === 0 && incoming[0]) incoming[0].isPrimary = true;
      replaceSlots((existing) => [...existing, ...incoming]);

      if (live) {
        void (async () => {
          for (const slot of incoming) {
            if (slot.validationError) continue;
            try {
              await uploadStaged(slot, productId);
            } catch {
              // The slot retains its actionable error state for retry/flush.
            }
          }
        })();
      }
    },
    [disabled, live, maxImages, productId, replaceSlots, uploadStaged],
  );

  const addURL = React.useCallback(
    (rawURL: string) => {
      if (
        disabled ||
        flushingRef.current ||
        pendingPersistenceRef.current.size > 0 ||
        inFlightUploadsRef.current.size > 0
      ) {
        return false;
      }
      setLimitMessage(null);
      const imageURL = rawURL.trim();
      const validationError = validateImageURL(imageURL);
      if (validationError) {
        setLimitMessage(validationError);
        return false;
      }
      const current = slotsRef.current;
      if (typeof maxImages === "number" && current.length >= maxImages) {
        setLimitMessage(`حداکثر ${maxImages} تصویر مجاز است.`);
        return false;
      }
      const duplicate = current.some((slot) =>
        slot.kind === "uploaded"
          ? slot.image.image_url === imageURL
          : slot.source.kind === "url" && slot.source.url === imageURL,
      );
      if (duplicate) {
        setLimitMessage("این نشانی تصویر قبلاً اضافه شده است.");
        return false;
      }

      const incoming: StagedSlot = {
        kind: "staged",
        localId: `slot-${idRef.current++}`,
        source: { kind: "url", url: imageURL },
        previewUrl: imageURL,
        alt: "",
        isPrimary: current.length === 0,
        status: "idle",
        progress: 0,
      };
      replaceSlots((existing) => [...existing, incoming]);
      if (live) {
        void uploadStaged(incoming, productId).catch(() => {});
      }
      return true;
    },
    [disabled, live, maxImages, productId, replaceSlots, uploadStaged],
  );

  const removeSlot = React.useCallback(
    (slot: Slot) => {
      if (disabled) return;
      if (slot.kind === "staged") {
        if (inFlightUploadsRef.current.has(slot.localId)) return;
        if (inFlightPreparationsRef.current.has(slot.localId)) return;
        releasePreparedSlot(slot.localId);
        revokePreview(slot.previewUrl);
        replaceSlots((current) => {
          return current.filter(
            (currentSlot) => currentSlot.localId !== slot.localId,
          );
        });
        announce("تصویر حذف شد.");
        return;
      }

      const previousIndex = slotsRef.current.findIndex(
        (currentSlot) => currentSlot.localId === slot.localId,
      );
      const wasPrimary = slot.image.is_primary;
      replaceSlots((current) =>
        current.filter((currentSlot) => currentSlot.localId !== slot.localId),
      );
      announce("تصویر حذف شد.");
      if (!live) return;

      persistenceErrorRef.current = null;
      trackPersistence(
        (async () => {
          const replacement = wasPrimary
            ? slotsRef.current.find(
                (candidate): candidate is UploadedSlot =>
                  candidate.kind === "uploaded",
              )
            : undefined;

          if (replacement) {
            try {
              await setPrimaryImage(productId, replacement.image.id);
              replaceSlots((current) =>
                current.map((candidate) =>
                  candidate.kind === "uploaded"
                    ? {
                        ...candidate,
                        image: {
                          ...candidate.image,
                          is_primary: candidate.localId === replacement.localId,
                        },
                      }
                    : candidate,
                ),
              );
            } catch (error) {
              replaceSlots((current) => {
                const restored = current.slice();
                restored.splice(Math.max(0, previousIndex), 0, slot);
                return restored;
              });
              persistenceErrorRef.current = asError(
                error,
                "تنظیم تصویر اصلی جایگزین ناموفق بود",
              );
              announce("حذف انجام نشد؛ تنظیم تصویر اصلی جایگزین ناموفق بود.");
              return;
            }
          }

          try {
            await deleteProductImage(productId, slot.image.id);
          } catch (error) {
            replaceSlots((current) => {
              if (
                current.some(
                  (currentSlot) => currentSlot.localId === slot.localId,
                )
              ) {
                return current;
              }
              const restored = current.slice();
              restored.splice(Math.max(0, previousIndex), 0, {
                ...slot,
                image: {
                  ...slot.image,
                  is_primary: replacement ? false : slot.image.is_primary,
                },
              });
              return restored;
            });
            persistenceErrorRef.current = asError(
              error,
              "حذف تصویر ناموفق بود",
            );
            announce("حذف تصویر ناموفق بود؛ بازگردانده شد.");
          }
        })(),
      );
    },
    [
      announce,
      disabled,
      live,
      productId,
      replaceSlots,
      releasePreparedSlot,
      revokePreview,
      trackPersistence,
    ],
  );

  const setAlt = React.useCallback(
    (slot: Slot, alt: string) => {
      if (
        disabled ||
        pendingPersistenceRef.current.size > 0 ||
        flushingRef.current
      ) {
        return;
      }
      replaceSlots((current) =>
        current.map((currentSlot) =>
          currentSlot.localId === slot.localId
            ? { ...currentSlot, alt }
            : currentSlot,
        ),
      );
    },
    [disabled, replaceSlots],
  );

  const commitAlt = React.useCallback(
    (slot: Slot) => {
      if (
        disabled ||
        !live ||
        slot.kind !== "uploaded" ||
        pendingPersistenceRef.current.size > 0 ||
        flushingRef.current
      ) {
        return;
      }
      const current = slotsRef.current.find(
        (candidate) => candidate.localId === slot.localId,
      );
      if (!current || current.kind !== "uploaded") return;
      const previousAlt = current.image.alt_text ?? "";
      if (current.alt === previousAlt) return;

      persistenceErrorRef.current = null;
      trackPersistence(
        (async () => {
          try {
            const image = await updateImageAlt(
              productId,
              current.image.id,
              current.alt,
            );
            replaceSlots((items) =>
              items.map((item) =>
                item.localId === current.localId && item.kind === "uploaded"
                  ? { ...item, image, alt: image.alt_text ?? "" }
                  : item,
              ),
            );
          } catch (error) {
            replaceSlots((items) =>
              items.map((item) =>
                item.localId === current.localId
                  ? { ...item, alt: previousAlt }
                  : item,
              ),
            );
            persistenceErrorRef.current = asError(
              error,
              "ذخیره متن جایگزین ناموفق بود",
            );
            announce("ذخیره متن جایگزین ناموفق بود؛ تغییر بازگردانده شد.");
          }
        })(),
      );
    },
    [announce, disabled, live, productId, replaceSlots, trackPersistence],
  );

  const persistGalleryState = React.useCallback(
    async (pid: number) => {
      const uploaded = slotsRef.current.filter(
        (slot): slot is UploadedSlot => slot.kind === "uploaded",
      );
      if (uploaded.length > 1) {
        await reorderProductImages(
          pid,
          uploaded.map((slot) => slot.image.id),
        );
      }
      const primary =
        uploaded.find((slot) => slot.image.is_primary) ?? uploaded[0];
      if (!primary) return;
      await setPrimaryImage(pid, primary.image.id);
      replaceSlots((items) =>
        items.map((item) =>
          item.kind === "uploaded"
            ? {
                ...item,
                image: {
                  ...item.image,
                  is_primary: item.localId === primary.localId,
                },
              }
            : item,
        ),
      );
    },
    [replaceSlots],
  );

  const move = React.useCallback(
    (from: number, to: number) => {
      const previous = slotsRef.current;
      if (
        disabled ||
        pendingPersistenceRef.current.size > 0 ||
        to < 0 ||
        to >= previous.length ||
        from === to
      ) {
        return false;
      }
      const next = previous.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      replaceSlots(() => next);
      announce(`تصویر به جایگاه ${to + 1} از ${next.length} منتقل شد.`);
      if (!live) return true;

      // Order and cover are the same fact now, so they persist together:
      // reordering used to leave `is_primary` on whichever image the operator
      // had just moved out of first place.
      persistenceErrorRef.current = null;
      trackPersistence(
        (async () => {
          try {
            await persistGalleryState(productId);
          } catch (error) {
            replaceSlots(() => previous);
            persistenceErrorRef.current = asError(
              error,
              "ذخیره ترتیب تصاویر ناموفق بود",
            );
            announce("ذخیره ترتیب تصاویر ناموفق بود؛ ترتیب بازگردانده شد.");
          }
        })(),
      );
      return true;
    },
    [
      announce,
      disabled,
      live,
      persistGalleryState,
      productId,
      replaceSlots,
      trackPersistence,
    ],
  );

  const moveUp = React.useCallback(
    (index: number) => {
      move(index, index - 1);
    },
    [move],
  );

  const moveDown = React.useCallback(
    (index: number) => {
      move(index, index + 1);
    },
    [move],
  );

  /**
   * Setting the cover *is* moving the image to the front (PE-8) — there is no
   * longer a star that can point somewhere other than the first slot.
   */
  const makePrimary = React.useCallback(
    (slot: Slot) => {
      const index = slotsRef.current.findIndex(
        (currentSlot) => currentSlot.localId === slot.localId,
      );
      if (index <= 0) return;
      if (move(index, 0)) announce("تصویر اصلی تنظیم شد.");
    },
    [announce, move],
  );

  const validate = React.useCallback(() => {
    const invalidAlt = slotsRef.current.find(
      (slot) => slot.alt.length > MAX_IMAGE_ALT_LENGTH,
    );
    if (invalidAlt) return "متن جایگزین باید حداکثر ۲۵۵ نویسه باشد";
    const invalid = slotsRef.current.find(
      (slot): slot is StagedSlot =>
        slot.kind === "staged" &&
        (slot.validationError || (!deferred && slot.status === "error")),
    );
    return invalid?.error ?? null;
  }, [deferred]);

  const persistDirtyAlts = React.useCallback(
    async (pid: number) => {
      const dirty = slotsRef.current.filter(
        (slot): slot is UploadedSlot =>
          slot.kind === "uploaded" && slot.alt !== (slot.image.alt_text ?? ""),
      );
      for (const slot of dirty) {
        const image = await updateImageAlt(pid, slot.image.id, slot.alt);
        replaceSlots((items) =>
          items.map((item) =>
            item.localId === slot.localId && item.kind === "uploaded"
              ? { ...item, image, alt: image.alt_text ?? "" }
              : item,
          ),
        );
      }
    },
    [replaceSlots],
  );

  const retryUpload = React.useCallback(
    (slot: StagedSlot) => {
      if (disabled || !live || slot.validationError) return;
      persistenceErrorRef.current = null;
      trackPersistence(
        uploadStaged(slot, productId)
          .then(() => persistGalleryState(productId))
          .catch((error) => {
            const retryError = asError(
              error,
              "هماهنگ‌سازی تصاویر پس از تلاش دوباره ناموفق بود",
            );
            persistenceErrorRef.current = retryError;
            setLimitMessage(retryError.message);
            announce("ذخیره تصویر کامل نشد؛ دوباره فرم را ذخیره کنید.");
          }),
      );
    },
    [
      announce,
      disabled,
      live,
      persistGalleryState,
      productId,
      trackPersistence,
      uploadStaged,
    ],
  );

  const flush = React.useCallback(
    async (ownerId?: number) => {
      if (flushingRef.current) throw new Error("ذخیره تصاویر در حال انجام است");
      const pid = ownerId ?? owner.ownerId ?? null;
      if (!pid || pid <= 0) throw new Error("شناسه مالک تصویر در دسترس نیست");
      const validationError = validate();
      if (validationError) throw new Error(validationError);
      flushingRef.current = true;
      setIsFlushing(true);
      try {
        await waitForPersistence();
        await persistDirtyAlts(pid);

        for (const slot of slotsRef.current) {
          if (slot.kind === "uploaded") continue;
          if (slot.validationError) {
            throw new Error(slot.error ?? "یکی از تصاویر معتبر نیست");
          }
          const inFlight = inFlightUploadsRef.current.get(slot.localId);
          if (inFlight) {
            await inFlight;
            continue;
          }
          if (slot.status === "error") {
            throw new Error(slot.error ?? "بارگذاری تصویر ناموفق بود");
          }
          await uploadStaged(slot, pid);
        }

        await waitForPersistence();
        const current = slotsRef.current;
        const failed = current.find((slot) => slot.kind === "staged");
        if (failed?.kind === "staged") {
          throw new Error(failed.error ?? "بارگذاری تصویر کامل نشد");
        }

        await persistGalleryState(pid);
      } finally {
        flushingRef.current = false;
        setIsFlushing(false);
      }
    },
    [
      owner.ownerId,
      persistDirtyAlts,
      persistGalleryState,
      uploadStaged,
      validate,
      waitForPersistence,
    ],
  );

  const prepareStagedUpload = React.useCallback(
    (slot: StagedSlot, file: File): Promise<UploadedImage> => {
      const prepared = preparedUploadsRef.current.get(slot.localId);
      if (prepared) return Promise.resolve(prepared);
      const inFlight = inFlightPreparationsRef.current.get(slot.localId);
      if (inFlight) return inFlight;

      patchStaged(slot.localId, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });
      const operation = uploadStandaloneImage(
        file,
        { folder: "uploads" },
        (progress) => patchStaged(slot.localId, { progress }),
      )
        .then(async (result) => {
          if (disposedRef.current) {
            await releaseUpload(result.key).catch(() => {
              // Reconciliation removes ownerless uploads if release fails.
            });
            throw new Error("بارگذاری لغو شد");
          }
          preparedUploadsRef.current.set(slot.localId, result);
          patchStaged(slot.localId, { status: "idle", progress: 1 });
          return result;
        })
        .catch((error) => {
          const uploadError = asError(error, "بارگذاری ناموفق بود");
          if (!disposedRef.current) {
            patchStaged(slot.localId, {
              status: "error",
              error: uploadError.message,
            });
          }
          throw uploadError;
        })
        .finally(() => {
          inFlightPreparationsRef.current.delete(slot.localId);
        });
      inFlightPreparationsRef.current.set(slot.localId, operation);
      return operation;
    },
    [patchStaged],
  );

  const prepare = React.useCallback(async (): Promise<
    PreparedProductImage[]
  > => {
    if (!deferred) {
      throw new Error("ذخیره تجمیعی تصاویر فعال نیست");
    }
    if (flushingRef.current) {
      throw new Error("ذخیره تصاویر در حال انجام است");
    }
    for (const slot of slotsRef.current) {
      if (
        slot.kind === "staged" &&
        slot.status === "error" &&
        !slot.validationError
      ) {
        patchStaged(slot.localId, { status: "idle", error: undefined });
      }
    }
    const validationError = validate();
    if (validationError) throw new Error(validationError);

    flushingRef.current = true;
    setIsFlushing(true);
    try {
      const result: PreparedProductImage[] = [];
      for (const slot of slotsRef.current) {
        const altText = slot.alt.trim() || null;
        if (slot.kind === "uploaded") {
          result.push({
            id: slot.image.id,
            alt_text: altText,
            is_primary: slot.image.is_primary,
          });
          continue;
        }
        if (slot.source.kind === "url") {
          result.push({
            image_url: slot.source.url,
            alt_text: altText,
            is_primary: slot.isPrimary,
          });
          continue;
        }
        const upload = await prepareStagedUpload(slot, slot.source.file);
        result.push({
          storage_key: upload.key,
          alt_text: altText,
          is_primary: slot.isPrimary,
        });
      }
      return result;
    } finally {
      flushingRef.current = false;
      setIsFlushing(false);
    }
  }, [deferred, patchStaged, prepareStagedUpload, validate]);

  const commit = React.useCallback(
    (images: ProductImage[]) => {
      for (const slot of slotsRef.current) {
        if (slot.kind === "staged") revokePreview(slot.previewUrl);
      }
      preparedUploadsRef.current.clear();
      preservePreparedRef.current = false;
      inFlightPreparationsRef.current.clear();
      const next: Slot[] = normalizeGallery(
        images
          .slice()
          .sort(galleryOrder)
          .map((image) => ({
            kind: "uploaded",
            localId: `committed-${image.id}`,
            image,
            alt: image.alt_text ?? "",
          })),
      );
      setCleanSignature(gallerySignature(next));
      replaceSlots(() => next);
      persistenceErrorRef.current = null;
      setLimitMessage(null);
    },
    [replaceSlots, revokePreview],
  );

  const rebase = React.useCallback(
    (images: ProductImage[]): ProductGalleryRebase => {
      const fresh = new Map(images.map((image) => [image.id, image]));
      const kept = new Set<number>();
      let dropped = 0;
      const survivors = slotsRef.current.filter((slot) => {
        // Staged work is the operator's own and never lives on the server yet.
        if (slot.kind === "staged") return true;
        const current = fresh.get(slot.image.id);
        if (!current) {
          dropped += 1;
          return false;
        }
        kept.add(slot.image.id);
        return true;
      });
      const adopted = images
        .filter((image) => !kept.has(image.id))
        .sort(galleryOrder)
        .map<Slot>((image) => ({
          kind: "uploaded",
          localId: `rebased-${image.id}`,
          image,
          alt: image.alt_text ?? "",
        }));
      replaceSlots(() => [...survivors, ...adopted]);
      return { dropped, adopted: adopted.length };
    },
    [replaceSlots],
  );

  const preservePrepared = React.useCallback((preserve: boolean) => {
    preservePreparedRef.current = preserve;
  }, []);

  const discardPrepared = React.useCallback(() => {
    preservePreparedRef.current = false;
    const prepared = Array.from(preparedUploadsRef.current.values());
    preparedUploadsRef.current.clear();
    for (const upload of prepared) {
      void releaseUpload(upload.key).catch(() => {
        // Reconciliation is the durable fallback for failed best-effort release.
      });
    }
    replaceSlots((current) =>
      current.map((slot) =>
        slot.kind === "staged" && slot.source.kind === "file"
          ? { ...slot, status: "idle", progress: 0, error: undefined }
          : slot,
      ),
    );
    announce("تصاویر ردشده برای بارگذاری دوباره آماده شدند.");
  }, [announce, replaceSlots]);

  return {
    slots,
    isPending:
      disabled ||
      isFlushing ||
      pendingCount > 0 ||
      slots.some(
        (slot) => slot.kind === "staged" && slot.status === "uploading",
      ),
    limitMessage,
    announcement,
    addFiles,
    addURL,
    removeSlot,
    makePrimary,
    setAlt,
    commitAlt,
    move,
    moveUp,
    moveDown,
    retryUpload,
    flush,
    prepare,
    preservePrepared,
    discardPrepared,
    rebase,
    commit,
    validate,
    isDirty,
    hasStaged: slots.some((slot) => slot.kind === "staged"),
  };
}
