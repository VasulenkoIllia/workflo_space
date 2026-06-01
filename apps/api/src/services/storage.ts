import { HetznerStorageAdapter, LocalStorageAdapter, type StorageAdapter } from '@workflo/storage'

/**
 * Process-wide storage adapter. `STORAGE_DRIVER=hetzner` switches to object
 * storage (Phase 2); the default is local disk under `UPLOAD_DIR`.
 */
let adapter: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (!adapter) {
    adapter =
      process.env.STORAGE_DRIVER === 'hetzner'
        ? new HetznerStorageAdapter()
        : new LocalStorageAdapter(process.env.UPLOAD_DIR ?? './uploads')
  }
  return adapter
}
