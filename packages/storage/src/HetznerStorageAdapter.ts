import type { StorageAdapter, StoredFile, UploadInput } from './StorageAdapter.js'

export class HetznerStorageAdapter implements StorageAdapter {
  upload(_input: UploadInput): Promise<StoredFile> {
    return Promise.reject(new Error('HetznerStorageAdapter will be implemented in Phase 2'))
  }

  read(_key: string): Promise<Buffer> {
    return Promise.reject(new Error('HetznerStorageAdapter will be implemented in Phase 2'))
  }

  delete(_key: string): Promise<void> {
    return Promise.reject(new Error('HetznerStorageAdapter will be implemented in Phase 2'))
  }
}
