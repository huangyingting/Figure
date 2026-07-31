import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

import { figureStorageKey } from "@/lib/storage/key";
import type { FigureStorage } from "@/lib/storage/types";

export class AzureFigureStorage implements FigureStorage {
  readonly kind = "azure" as const;

  private service() {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    }
    const account = process.env.AZURE_STORAGE_ACCOUNT;
    const key = process.env.AZURE_STORAGE_KEY;
    if (!account || !key) throw new Error("Azure figure storage credentials are incomplete.");
    return new BlobServiceClient(`https://${account}.blob.core.windows.net`, new StorageSharedKeyCredential(account, key));
  }

  private async container() {
    const container = this.service().getContainerClient(process.env.AZURE_STORAGE_CONTAINER || "figures");
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
    } catch { return null; }
  }

  async delete(key: string) {
    await (await this.container()).getBlockBlobClient(key).deleteIfExists();
  }
}
