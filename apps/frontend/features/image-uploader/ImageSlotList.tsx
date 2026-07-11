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

  if (slots.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
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
            onMoveUp={() => onMoveUp(i)}
            onMoveDown={() => onMoveDown(i)}
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
