import type { PartSpec } from "@/lib/contracts";

function fallbackId(index: number): string {
  return `part_${String(index + 1).padStart(2, "0")}`;
}

export function parsePartLines(value: string): PartSpec[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("Add at least two components.");
  if (lines.length > 12) throw new Error("A maximum of 12 components can be located at once.");

  return lines.map((line, index) => {
    const separator = line.indexOf("|");
    if (separator < 0) {
      throw new Error(`Line ${index + 1} needs a “|” separator and description.`);
    }

    const rawName = line.slice(0, separator).trim();
    const description = line.slice(separator + 1).trim();
    const explicit = rawName.match(/^\[([a-z0-9][a-z0-9_-]*)\]\s*(.+)$/i);
    const id = explicit?.[1] || fallbackId(index);
    const name = (explicit?.[2] || rawName).trim();

    if (!name) throw new Error(`Line ${index + 1} needs a component name.`);
    if (!description) throw new Error(`Line ${index + 1} needs a component description.`);
    return { id, name, description };
  });
}
