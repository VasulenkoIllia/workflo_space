export interface StoredFile {
  key: string
  url?: string
}

export interface UploadInput {
  key: string
  buffer: Buffer
  contentType: string
}

export interface StorageAdapter {
  upload(input: UploadInput): Promise<StoredFile>
  delete(key: string): Promise<void>
}
