import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

import { getApplicationConfig } from "@/lib/config";
import { figureStorageKey } from "@/lib/storage/key";
import type { FigureStorage } from "@/lib/storage/types";

export class AzureFigureStorage implements FigureStorage {
  readonly kind = "azure" as const;

  private service() {
    const { storage } = getApplicationConfig();
    if (storage.connectionString) {
      return BlobServiceClient.fromConnectionString(storage.connectionString);
    }
    const { account, key } = storage;
    if (!account || !key) throw new Error("Azure figure storage credentials are incomplete.");
    return new BlobServiceClient(`https://${account}.blob.core.windows.net`, new StorageSharedKeyCredential(account, key));
  }

  private async container() {
    const container = this.service().getContainerClient(getApplicationConfig().storage.container);
    await container.createIfNotExists();
    return container;
  }

  async put(data: Buffer, mimeType: string, ownerId: string) {
    const { checksum, key } = figureStorageKey(data, mimeType, ownerId);
    await (await this.container()).getBlockBlobClient(key).uploadData(data, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
    return { storageKey: key, sizeBytes: data.byteLength, checksum };
  }

  async get(key: string) {
    try {
      const response = await (await this.container()).getBlockBlobClient(key).downloadToBuffer();
      return response;
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) return null;
      throw error;
    }
  }

  async delete(key: string) {
    await (await this.container()).getBlockBlobClient(key).deleteIfExists();
  }
}
