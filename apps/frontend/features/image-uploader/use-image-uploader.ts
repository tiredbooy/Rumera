"use client";

import * as React from "react";
import { useTransition } from "react";
import { uploadProductImage } from "../admin/products/api/api";
import {
  deleteProductImage,
  reorderProductImages,
  setPrimaryImage,
  updateImageAlt,
} from "../admin/products/actions/images";
import { isSameFile, validateFile } from "./constants";
import type {
  ImageUploaderProps,
  Slot,
  StagedSlot,
  UploadedSlot,
} from "./types";

export function useImageUploader({
  productId,
  initialImages = [],
  maxImages,
}: ImageUploaderProps) {
  const live = typeof productId === "number" && productId > 0;
  const idRef = React.useRef(0);
  const nextId = () => `slot-${idRef.current++}`;

  const [isPending, startTransition] = useTransition();
  const [slots, setSlots] = React.useState<Slot[]>(() =>
    initialImages
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        kind: "uploaded" as const,
        localId: `init-${image.id}`,
        image,
        alt: image.alt_text ?? "",
      })),
  );
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const announce = React.useCallback((msg: string) => setAnnouncement(msg), []);

  // Revoke object URLs on unmount to avoid leaks.
  React.useEffect(() => {
    return () => {
      setSlots((cur) => {
        cur.forEach(
          (s) => s.kind === "staged" && URL.revokeObjectURL(s.previewUrl),
        );
        return cur;
      });
    };
  }, []);

  const patch = React.useCallback(
    (localId: string, next: Partial<StagedSlot>) => {
      setSlots((cur) =>
        cur.map((s) =>
          s.localId === localId && s.kind === "staged" ? { ...s, ...next } : s,
        ),
      );
    },
    [],
  );

  const uploadStaged = React.useCallback(
    async (slot: StagedSlot, pid: number): Promise<ProductImage | null> => {
      patch(slot.localId, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });
      try {
        const image = await uploadProductImage(
          pid,
          slot.file,
          { altText: slot.alt || undefined, isPrimary: slot.isPrimary },
          (f) => patch(slot.localId, { progress: f }),
        );
        URL.revokeObjectURL(slot.previewUrl);
        setSlots((cur) =>
          cur.map((s) =>
            s.localId === slot.localId
              ? {
                  kind: "uploaded",
                  localId: s.localId,
                  image,
                  alt: image.alt_text ?? "",
                }
              : s,
          ),
        );
        return image;
      } catch (e) {
        patch(slot.localId, {
          status: "error",
          error: e instanceof Error ? e.message : "بارگذاری ناموفق بود",
        });
        return null;
      }
    },
    [patch],
  );

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      setLimitMessage(null);
      const incomingFiles = Array.from(files);
      let toUpload: StagedSlot[] = [];

      setSlots((cur) => {
        const existingFiles = cur
          .filter((s): s is StagedSlot => s.kind === "staged")
          .map((s) => s.file);

        const room =
          typeof maxImages === "number"
            ? Math.max(0, maxImages - cur.length)
            : Infinity;
        if (room === 0) {
          setLimitMessage(`حداکثر ${maxImages} تصویر مجاز است.`);
          return cur;
        }

        const deduped = incomingFiles.filter(
          (f) => !existingFiles.some((ef) => isSameFile(ef, f)),
        );
        const accepted = deduped.slice(0, room);

        if (accepted.length < incomingFiles.length) {
          setLimitMessage(
            accepted.length < deduped.length
              ? `فقط ${accepted.length} تصویر اضافه شد؛ حداکثر ${maxImages} تصویر مجاز است.`
              : "برخی تصاویر تکراری بودند و نادیده گرفته شدند.",
          );
        }

        const incoming: StagedSlot[] = accepted.map((file) => {
          const error = validateFile(file);
          return {
            kind: "staged",
            localId: nextId(),
            file,
            previewUrl: URL.createObjectURL(file),
            alt: "",
            isPrimary: false,
            status: error ? "error" : "idle",
            progress: 0,
            error: error ?? undefined,
          };
        });

        const hasPrimary = cur.some((s) =>
          s.kind === "uploaded" ? s.image.is_primary : s.isPrimary,
        );
        if (!hasPrimary && incoming[0] && !incoming[0].error)
          incoming[0].isPrimary = true;

        toUpload = incoming;
        return [...cur, ...incoming];
      });

      if (live) {
        toUpload.forEach((s) => {
          if (!s.error) uploadStaged(s, productId as number);
        });
      }
    },
    [live, maxImages, productId, uploadStaged],
  );

  const removeSlot = React.useCallback(
    (slot: Slot) => {
      if (slot.kind === "staged") {
        URL.revokeObjectURL(slot.previewUrl);
        setSlots((cur) => cur.filter((s) => s.localId !== slot.localId));
        announce("تصویر حذف شد.");
        return;
      }
      setSlots((cur) => cur.filter((s) => s.localId !== slot.localId));
      announce("تصویر حذف شد.");
      if (live) {
        startTransition(async () => {
          try {
            await deleteProductImage(productId as number, slot.image.id);
          } catch {
            // Re-add on failure so the UI stays truthful.
            setSlots((cur) => [...cur, slot]);
            announce("حذف تصویر ناموفق بود؛ بازگردانده شد.");
          }
        });
      }
    },
    [live, productId, announce],
  );

  const makePrimary = React.useCallback(
    (slot: Slot) => {
      setSlots((cur) =>
        cur.map((s) => {
          const isThis = s.localId === slot.localId;
          if (s.kind === "uploaded")
            return { ...s, image: { ...s.image, is_primary: isThis } };
          return { ...s, isPrimary: isThis };
        }),
      );
      announce("تصویر اصلی تنظیم شد.");
      if (live && slot.kind === "uploaded") {
        startTransition(async () => {
          await setPrimaryImage(productId as number, slot.image.id).catch(
            () => {},
          );
        });
      }
    },
    [live, productId, announce],
  );

  const setAlt = React.useCallback((slot: Slot, alt: string) => {
    setSlots((cur) =>
      cur.map((s) => (s.localId === slot.localId ? { ...s, alt } : s)),
    );
  }, []);

  const commitAlt = React.useCallback(
    (slot: Slot) => {
      if (live && slot.kind === "uploaded") {
        startTransition(async () => {
          await updateImageAlt(
            productId as number,
            slot.image.id,
            slot.alt,
          ).catch(() => {});
        });
      }
    },
    [live, productId],
  );

  const move = React.useCallback(
    (from: number, to: number) => {
      setSlots((cur) => {
        if (to < 0 || to >= cur.length || from === to) return cur;
        const next = cur.slice();
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        if (live) {
          const ids = next
            .filter((s): s is UploadedSlot => s.kind === "uploaded")
            .map((s) => s.image.id);
          if (ids.length > 1) {
            startTransition(async () => {
              await reorderProductImages(productId as number, ids).catch(
                () => {},
              );
            });
          }
        }
        return next;
      });
    },
    [live, productId],
  );

  const moveUp = React.useCallback(
    (index: number) => {
      move(index, index - 1);
      announce("ترتیب تصویر تغییر کرد.");
    },
    [move, announce],
  );

  const moveDown = React.useCallback(
    (index: number) => {
      move(index, index + 1);
      announce("ترتیب تصویر تغییر کرد.");
    },
    [move, announce],
  );

  const retryUpload = React.useCallback(
    (slot: StagedSlot) => {
      if (live) uploadStaged(slot, productId as number);
    },
    [live, productId, uploadStaged],
  );

  const flush = React.useCallback(
    async (pid: number) => {
      const ordered: number[] = [];
      let primaryId: number | null = null;
      for (const s of slots) {
        if (s.kind === "uploaded") {
          ordered.push(s.image.id);
          if (s.image.is_primary) primaryId = s.image.id;
          continue;
        }
        if (s.status === "uploading") continue;
        const image = await uploadStaged(s, pid);
        if (image) {
          ordered.push(image.id);
          if (s.isPrimary) primaryId = image.id;
        }
      }
      if (ordered.length > 1)
        await reorderProductImages(pid, ordered).catch(() => {});
      if (primaryId !== null)
        await setPrimaryImage(pid, primaryId).catch(() => {});
    },
    [slots, uploadStaged],
  );

  return {
    slots,
    isPending,
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
    hasStaged: slots.some((s) => s.kind === "staged"),
  };
}
