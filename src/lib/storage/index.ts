import path from "node:path";

import { AzureFigureStorage } from "@/lib/storage/azure";
import { FilesystemFigureStorage } from "@/lib/storage/filesystem";
import type { FigureStorage } from "@/lib/storage/types";

let resolved: FigureStorage | null = null;

export function getFigureStorage(): FigureStorage {
  if (resolved) return resolved;
  resolved = process.env.FIGURE_STORAGE === "azure"
    ? new AzureFigureStorage()
    : new FilesystemFigureStorage(path.resolve(/* turbopackIgnore: true */ process.env.FIGURE_STORAGE_DIR || ".media"));
  return resolved;
}

export function dataUrlToBuffer(src: string): Buffer {
  const match = /^data:[^;]+;base64,(.+)$/s.exec(src);
  if (!match) throw new Error("Generated image is not a base64 data URL.");
  return Buffer.from(match[1], "base64");
}
