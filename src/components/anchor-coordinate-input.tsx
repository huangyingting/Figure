"use client";

import { useState } from "react";

export function parseAnchorCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.min(1, Math.max(0, coordinate)) : null;
}

export function AnchorCoordinateInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value.toFixed(3));
  const [editing, setEditing] = useState(false);
  return (
    <input
      type="number"
      min={0}
      max={1}
      step={0.001}
      disabled={disabled}
      className={className}
      value={editing ? draft : value.toFixed(3)}
      onFocus={() => { setDraft(value.toFixed(3)); setEditing(true); }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        setEditing(false);
        const coordinate = parseAnchorCoordinate(event.target.value);
        if (coordinate !== null && coordinate !== value) onChange(coordinate);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.value = value.toFixed(3);
          event.currentTarget.blur();
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
