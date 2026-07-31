import { promises as fs } from "node:fs";
import path from "node:path";

import { figureStorageKey } from "@/lib/storage/key";
import type { FigureStorage } from "@/lib/storage/types";

export class FilesystemFigureStorage implements FigureStorage {
  readonly kind = "local" as const;
  constructor(private readonly baseDir: string) {}

  private resolve(key: string) {
    const base = path.resolve(this.baseDir);
    const full = path.resolve(base, key);
    if (full !== base && !full.startsWith(`${base}${path.sep}`)) throw new Error("Storage key escapes base directory.");
    return full;
  }

  async put(data: Buffer, mimeType: string, ownerId: string) {
    const { checksum, key } = figureStorageKey(data, mimeType, ownerId);
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return { storageKey: key, sizeBytes: data.byteLength, checksum };
  }

  async get(key: string) {
    try { return await fs.readFile(this.resolve(key)); } catch { return null; }
  }

  async delete(key: string) {
    try { await fs.unlink(this.resolve(key)); } catch { /* idempotent */ }
  }
}
