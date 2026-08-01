"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/components/ui";

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
    <div className={cn("relative min-w-[188px]", open && "z-[80]")} ref={root}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-4 rounded-[9px] border border-line-dark bg-paper py-2 pl-[14px] pr-3 text-left text-ink cursor-pointer",
          compact ? "min-h-[40px]" : "min-h-[48px]",
        )}
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
        <span className={compact ? "flex items-center gap-[7px]" : "grid gap-[2px]"}>
          <small className={cn("text-micro font-extrabold uppercase tracking-[0.09em] text-muted", compact && "after:content-[':']")}>{label}</small>
          <strong className="text-ui whitespace-nowrap">{selected?.label}</strong>
        </span>
        <ChevronDown size={16} aria-hidden className={cn("text-pine transition-transform duration-[180ms]", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+7px)] z-[80] min-w-full overflow-hidden rounded-[11px] border border-line bg-paper p-[6px] shadow-[0_20px_55px_rgb(35_33_27_/_16%)]"
          id={listId}
          role="listbox"
          aria-label={label}
        >
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
              className="flex w-full min-h-[45px] items-center justify-between gap-[18px] rounded-[7px] px-[9px] py-[7px] text-left text-ink-2 cursor-pointer data-[active=true]:bg-pine-pale data-[active=true]:text-pine-dark"
            >
              <span className="grid gap-[2px]">
                <strong className="text-ui">{option.label}</strong>
                {option.hint && <small className="text-micro text-muted">{option.hint}</small>}
              </span>
              {option.value === value && <Check size={15} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
