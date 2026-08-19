"use client";

import * as React from "react";
import type { Slot, StagedSlot } from "./product-types";
import { ImageSlotItem } from "./ImageSlotItem";

type ImageSlotListProps = {
  slots: Slot[];
  isPending: boolean;
  live: boolean;
  onAltChange: (slot: Slot, alt: string) => void;
  onAltCommit: (slot: Slot) => void;
  onMakePrimary: (slot: Slot) => void;
  onRemove: (slot: Slot) => void;
  onRetry: (slot: StagedSlot) => void;
  onMove: (from: number, to: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

export function ImageSlotList({
  slots,
  isPending,
  live,
  onAltChange,
  onAltCommit,
  onMakePrimary,
  onRemove,
  onRetry,
  onMove,
  onMoveUp,
  onMoveDown,
}: ImageSlotListProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [focusVersion, requestFocus] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const listRef = React.useRef<HTMLUListElement>(null);
  const focusRequestRef = React.useRef<{
    localId: string;
    direction: "prev" | "next";
  } | null>(null);

  React.useLayoutEffect(() => {
    const request = focusRequestRef.current;
    if (!request) return;

    const controls = listRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-image-reorder]",
    );
    const itemControls = Array.from(controls ?? []).filter(
      (candidate) => candidate.dataset.imageReorder === request.localId,
    );
    const control =
      itemControls.find(
        (candidate) =>
          candidate.dataset.reorderDirection === request.direction &&
          !candidate.disabled,
      ) ?? itemControls.find((candidate) => !candidate.disabled);
    if (!control) {
      if (!isPending) focusRequestRef.current = null;
      return;
    }
    control.focus();
    focusRequestRef.current = null;
  }, [focusVersion, isPending, slots]);

  if (slots.length === 0) return null;

  return (
    // A grid, not a column: a gallery is compared side by side, and a
    // one-per-row list of thumbnails pushed the sixth image off-screen.
    <ul
      ref={listRef}
      aria-label="تصاویر محصول"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
    >
      {slots.map((slot, i) => {
        const isPrimary =
          slot.kind === "uploaded" ? slot.image.is_primary : slot.isPrimary;
        return (
          <ImageSlotItem
            key={slot.localId}
            slot={slot}
            index={i}
            total={slots.length}
            isPending={isPending}
            isDragging={dragIndex === i}
            isDropTarget={dropIndex === i && dragIndex !== i}
            isPrimary={isPrimary}
            canRetry={live}
            onAltChange={(alt) => onAltChange(slot, alt)}
            onAltCommit={() => onAltCommit(slot)}
            onMakePrimary={() => onMakePrimary(slot)}
            onRemove={() => onRemove(slot)}
            onRetry={() => slot.kind === "staged" && onRetry(slot)}
            onMovePrev={() => {
              focusRequestRef.current = {
                localId: slot.localId,
                direction: "prev",
              };
              onMoveUp(i);
              requestFocus();
            }}
            onMoveNext={() => {
              focusRequestRef.current = {
                localId: slot.localId,
                direction: "next",
              };
              onMoveDown(i);
              requestFocus();
            }}
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(i);
            }}
            onDragLeave={() =>
              setDropIndex((current) => (current === i ? null : current))
            }
            onDrop={() => {
              if (dragIndex !== null) onMove(dragIndex, i);
              setDragIndex(null);
              setDropIndex(null);
            }}
          />
        );
      })}
    </ul>
  );
}
