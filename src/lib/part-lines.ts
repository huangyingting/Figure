import type { PartSpec } from "@/lib/contracts";

function fallbackId(index: number): string {
  return `part_${String(index + 1).padStart(2, "0")}`;
}

export function parsePartLines(value: string): PartSpec[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("请至少填写两个部件。 ");
  if (lines.length > 12) throw new Error("PoC 每次最多定位 12 个部件。 ");

  return lines.map((line, index) => {
    const separator = line.indexOf("|");
    if (separator < 0) {
      throw new Error(`第 ${index + 1} 行缺少“|”和部件说明。`);
    }

    const rawName = line.slice(0, separator).trim();
    const description = line.slice(separator + 1).trim();
    const explicit = rawName.match(/^\[([a-z0-9][a-z0-9_-]*)\]\s*(.+)$/i);
    const id = explicit?.[1] || fallbackId(index);
    const name = (explicit?.[2] || rawName).trim();

    if (!name) throw new Error(`第 ${index + 1} 行缺少部件名称。`);
    if (!description) throw new Error(`第 ${index + 1} 行缺少部件说明。`);
    return { id, name, description };
  });
}
