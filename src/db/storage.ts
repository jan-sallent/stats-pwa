export type StoragePersistenceStatus = 'persistent' | 'best-effort' | 'unsupported'

export async function getStoragePersistenceStatus(): Promise<StoragePersistenceStatus> {
  if (!navigator.storage?.persisted) {
    return 'unsupported'
  }

  try {
    return (await navigator.storage.persisted()) ? 'persistent' : 'best-effort'
  } catch {
    return 'best-effort'
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false
  }

  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
