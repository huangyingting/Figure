import { createHash } from "node:crypto";

const extensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export function figureStorageKey(data: Buffer, mimeType: string, ownerId: string) {
  const checksum = sha256(data);
  const scoped = createHash("sha256")
    .update("figure-storage-v1\0")
    .update(ownerId)
    .update("\0")
    .update(checksum)
    .digest("hex")
    .slice(0, 32);
  return { checksum, key: `figures/${scoped}${extensions[mimeType] || ".bin"}` };
}
