import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FilesystemFigureStorage } from "@/lib/storage/filesystem";
import { figureStorageKey } from "@/lib/storage/key";

const tempDirs: string[] = [];
afterEach(async () => Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe("figure storage", () => {
  it("creates stable owner-scoped content keys with a MIME extension", () => {
    const data = Buffer.from("figure bytes");
    const first = figureStorageKey(data, "image/png", "owner-a");
    const repeated = figureStorageKey(data, "image/png", "owner-a");
    const otherOwner = figureStorageKey(data, "image/png", "owner-b");
    expect(first).toEqual(repeated);
    expect(first.key).toMatch(/^figures\/[a-f0-9]{32}\.png$/);
    expect(otherOwner.key).not.toBe(first.key);
  });

  it("round-trips bytes and keeps keys confined to its base directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "figure-storage-"));
    tempDirs.push(dir);
    const storage = new FilesystemFigureStorage(dir);
    const data = Buffer.from("private visual");
    const stored = await storage.put(data, "image/webp", "owner-a");
    expect(await storage.get(stored.storageKey)).toEqual(data);
    expect(await storage.get("../../outside.txt")).toBeNull();
    await storage.delete(stored.storageKey);
    expect(await storage.get(stored.storageKey)).toBeNull();
  });
});
