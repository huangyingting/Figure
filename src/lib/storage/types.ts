export type FigureStorageKind = "local" | "azure";

export interface StoredObject {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
}

export interface FigureStorage {
  readonly kind: FigureStorageKind;
  put(data: Buffer, mimeType: string, ownerId: string): Promise<StoredObject>;
  get(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<void>;
}
