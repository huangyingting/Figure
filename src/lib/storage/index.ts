import path from "node:path";

import { getApplicationConfig } from "@/lib/config";
import { AzureFigureStorage } from "@/lib/storage/azure";
import { FilesystemFigureStorage } from "@/lib/storage/filesystem";
import type { FigureStorage } from "@/lib/storage/types";

let resolved: FigureStorage | null = null;

export function getFigureStorage(): FigureStorage {
  if (resolved) return resolved;
  const { storage } = getApplicationConfig();
  if (!["local", "azure"].includes(storage.kind)) {
    throw new Error("FIGURE_STORAGE must be local or azure.");
  }
  resolved = storage.kind === "azure"
    ? new AzureFigureStorage()
    : new FilesystemFigureStorage(path.resolve(/* turbopackIgnore: true */ storage.directory));
  return resolved;
}

export function dataUrlToBuffer(src: string): Buffer {
  const match = /^data:[^;]+;base64,(.+)$/s.exec(src);
  if (!match) throw new Error("Generated image is not a base64 data URL.");
  return Buffer.from(match[1], "base64");
}
