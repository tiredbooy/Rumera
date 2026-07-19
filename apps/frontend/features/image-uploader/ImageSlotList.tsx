"use client";

import * as React from "react";
import type { Slot, StagedSlot } from "./types";
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
  const [focusVersion, requestFocus] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const listRef = React.useRef<HTMLUListElement>(null);
  const focusRequestRef = React.useRef<{
    localId: string;
    direction: "up" | "down";
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
    <ul ref={listRef} aria-label="تصاویر محصول" className="flex flex-col gap-2">
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
            isPrimary={isPrimary}
            canRetry={live}
            onAltChange={(alt) => onAltChange(slot, alt)}
            onAltCommit={() => onAltCommit(slot)}
            onMakePrimary={() => onMakePrimary(slot)}
            onRemove={() => onRemove(slot)}
            onRetry={() => slot.kind === "staged" && onRetry(slot)}
            onMoveUp={() => {
              focusRequestRef.current = {
                localId: slot.localId,
                direction: "down",
              };
              onMoveUp(i);
              requestFocus();
            }}
            onMoveDown={() => {
              focusRequestRef.current = {
                localId: slot.localId,
                direction: "up",
              };
              onMoveDown(i);
              requestFocus();
            }}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) onMove(dragIndex, i);
              setDragIndex(null);
            }}
          />
        );
      })}
    </ul>
  );
}
