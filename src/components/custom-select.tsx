"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption { value: string; label: string; hint?: string }

export function CustomSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, options.findIndex((option) => option.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActive(index);
    setOpen(false);
  }

  return (
    <div className={`custom-select${compact ? " is-compact" : ""}`} ref={root}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const next = (active + delta + options.length) % options.length;
            setActive(next);
            setOpen(true);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : options.length - 1);
            setOpen(true);
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); choose(active);
          } else if (event.key === "Escape") setOpen(false);
        }}
      >
        <span><small>{label}</small><strong>{selected?.label}</strong></span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="custom-select-menu" id={listId} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              <span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>
              {option.value === value && <Check size={15} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
