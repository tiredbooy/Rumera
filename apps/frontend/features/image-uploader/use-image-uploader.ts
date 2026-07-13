"use client";

import * as React from "react";
import { uploadProductImage } from "../admin/products/api/client";
import {
  deleteProductImage,
  reorderProductImages,
  setPrimaryImage,
  updateImageAlt,
} from "../admin/products/actions/images";
import { isSameFile, validateFile } from "./constants";
import type { ProductImage } from "../catalog/products/types";
import type {
  ImageUploaderProps,
  Slot,
  StagedSlot,
  UploadedSlot,
} from "./types";

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export function useImageUploader({
  productId,
  initialImages = [],
  maxImages,
}: ImageUploaderProps) {
  const live = typeof productId === "number" && productId > 0;
  const idRef = React.useRef(0);
  const initialSlots = React.useMemo<Slot[]>(
    () =>
      initialImages
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((image) => ({
          kind: "uploaded",
          localId: `init-${image.id}`,
          image,
          alt: image.alt_text ?? "",
        })),
    [initialImages],
  );
  const [slots, setSlots] = React.useState<Slot[]>(initialSlots);
  const slotsRef = React.useRef(slots);
  const objectUrlsRef = React.useRef(new Set<string>());
  const inFlightUploadsRef = React.useRef(
    new Map<string, Promise<ProductImage>>(),
  );
  const pendingPersistenceRef = React.useRef(new Set<Promise<void>>());
  const persistenceErrorRef = React.useRef<Error | null>(null);
  const flushingRef = React.useRef(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isFlushing, setIsFlushing] = React.useState(false);
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");

  const announce = React.useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const replaceSlots = React.useCallback(
    (update: (current: Slot[]) => Slot[]) => {
      const next = update(slotsRef.current);
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
    const objectUrls = objectUrlsRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const patchStaged = React.useCallback(
    (localId: string, next: Partial<StagedSlot>) => {
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
          const image = await uploadProductImage(
            pid,
            slot.file,
            { altText: slot.alt || undefined, isPrimary: slot.isPrimary },
            (progress) => patchStaged(slot.localId, { progress }),
          );
          revokePreview(slot.previewUrl);
          replaceSlots((current) =>
            current.map((currentSlot) =>
              currentSlot.localId === slot.localId
                ? {
                    kind: "uploaded",
                    localId: currentSlot.localId,
                    image: { ...image, is_primary: slot.isPrimary },
                    alt: image.alt_text ?? "",
                  }
                : currentSlot,
            ),
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
        flushingRef.current ||
        pendingPersistenceRef.current.size > 0 ||
        inFlightUploadsRef.current.size > 0
      ) {
        return;
      }
      setLimitMessage(null);
      const current = slotsRef.current;
      const existingFiles = current
        .filter((slot): slot is StagedSlot => slot.kind === "staged")
        .map((slot) => slot.file);
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
          file,
          previewUrl,
          alt: "",
          isPrimary: false,
          status: error ? "error" : "idle",
          progress: 0,
          error: error ?? undefined,
          validationError: Boolean(error),
        };
      });

      const hasPrimary = current.some((slot) =>
        slot.kind === "uploaded" ? slot.image.is_primary : slot.isPrimary,
      );
      const firstValid = incoming.find((slot) => !slot.validationError);
      if (!hasPrimary && firstValid) firstValid.isPrimary = true;
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
    [live, maxImages, productId, replaceSlots, uploadStaged],
  );

  const removeSlot = React.useCallback(
    (slot: Slot) => {
      if (slot.kind === "staged") {
        if (inFlightUploadsRef.current.has(slot.localId)) return;
        revokePreview(slot.previewUrl);
        replaceSlots((current) =>
          current.filter((currentSlot) => currentSlot.localId !== slot.localId),
        );
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
                          is_primary:
                            candidate.localId === replacement.localId,
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
    [announce, live, productId, replaceSlots, revokePreview, trackPersistence],
  );

  const makePrimary = React.useCallback(
    (slot: Slot) => {
      const previousPrimary = new Map(
        slotsRef.current.map((currentSlot) => [
          currentSlot.localId,
          currentSlot.kind === "uploaded"
            ? currentSlot.image.is_primary
            : currentSlot.isPrimary,
        ]),
      );
      replaceSlots((current) =>
        current.map((currentSlot) => {
          const isPrimary = currentSlot.localId === slot.localId;
          return currentSlot.kind === "uploaded"
            ? {
                ...currentSlot,
                image: { ...currentSlot.image, is_primary: isPrimary },
              }
            : { ...currentSlot, isPrimary };
        }),
      );
      announce("تصویر اصلی تنظیم شد.");
      if (!live || slot.kind !== "uploaded") return;

      persistenceErrorRef.current = null;
      trackPersistence(
        (async () => {
          try {
            await setPrimaryImage(productId, slot.image.id);
          } catch (error) {
            replaceSlots((current) =>
              current.map((currentSlot) => {
                const isPrimary = previousPrimary.get(currentSlot.localId) ?? false;
                return currentSlot.kind === "uploaded"
                  ? {
                      ...currentSlot,
                      image: { ...currentSlot.image, is_primary: isPrimary },
                    }
                  : { ...currentSlot, isPrimary };
              }),
            );
            persistenceErrorRef.current = asError(
              error,
              "تنظیم تصویر اصلی ناموفق بود",
            );
            announce("تنظیم تصویر اصلی ناموفق بود؛ تغییر بازگردانده شد.");
          }
        })(),
      );
    },
    [announce, live, productId, replaceSlots, trackPersistence],
  );

  const setAlt = React.useCallback(
    (slot: Slot, alt: string) => {
      if (pendingPersistenceRef.current.size > 0 || flushingRef.current) return;
      replaceSlots((current) =>
        current.map((currentSlot) =>
          currentSlot.localId === slot.localId
            ? { ...currentSlot, alt }
            : currentSlot,
        ),
      );
    },
    [replaceSlots],
  );

  const commitAlt = React.useCallback(
    (slot: Slot) => {
      if (
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
    [announce, live, productId, replaceSlots, trackPersistence],
  );

  const move = React.useCallback(
    (from: number, to: number) => {
      const previous = slotsRef.current;
      if (
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
      if (!live) return true;

      const ids = next
        .filter((slot): slot is UploadedSlot => slot.kind === "uploaded")
        .map((slot) => slot.image.id);
      if (ids.length < 2) return true;
      persistenceErrorRef.current = null;
      trackPersistence(
        (async () => {
          try {
            await reorderProductImages(productId, ids);
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
    [announce, live, productId, replaceSlots, trackPersistence],
  );

  const moveUp = React.useCallback(
    (index: number) => {
      if (move(index, index - 1)) announce("ترتیب تصویر تغییر کرد.");
    },
    [announce, move],
  );

  const moveDown = React.useCallback(
    (index: number) => {
      if (move(index, index + 1)) announce("ترتیب تصویر تغییر کرد.");
    },
    [announce, move],
  );

  const retryUpload = React.useCallback(
    (slot: StagedSlot) => {
      if (!live || slot.validationError) return;
      void uploadStaged(slot, productId).catch(() => {});
    },
    [live, productId, uploadStaged],
  );

  const flush = React.useCallback(
    async (pid: number) => {
      if (flushingRef.current) throw new Error("ذخیره تصاویر در حال انجام است");
      flushingRef.current = true;
      setIsFlushing(true);
      try {
        await waitForPersistence();

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

        const uploaded = current.filter(
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
        if (primary) {
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
        }
      } finally {
        flushingRef.current = false;
        setIsFlushing(false);
      }
    },
    [replaceSlots, uploadStaged, waitForPersistence],
  );

  return {
    slots,
    isPending:
      isFlushing ||
      pendingCount > 0 ||
      slots.some(
        (slot) => slot.kind === "staged" && slot.status === "uploading",
      ),
    limitMessage,
    announcement,
    addFiles,
    removeSlot,
    makePrimary,
    setAlt,
    commitAlt,
    move,
    moveUp,
    moveDown,
    retryUpload,
    flush,
    hasStaged: slots.some((slot) => slot.kind === "staged"),
  };
}
