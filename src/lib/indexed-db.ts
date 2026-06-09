import { StateStorage } from 'zustand/middleware'

const DB_NAME = 'nai-assistant-db'
const STORE_NAME = 'keyval'

const WRITE_DEBOUNCE_MS: Record<string, number> = {
    'generation-storage': 1200,
    'nais2-character-store': 1200,
    'artist-storage': 800,
    'nais-scenes': 800,
}

const MAX_PENDING_MS = 4000

type PendingWrite = {
    value: string
    timer: number | null
    queuedAt: number
    resolvers: Array<() => void>
    rejectors: Array<(reason?: unknown) => void>
}

const pendingWrites = new Map<string, PendingWrite>()

// Simple Promise-based IDB wrapper
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this environment'))
        return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
        }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

export const indexedDBStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const db = await dbPromise
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly')
                const store = transaction.objectStore(STORE_NAME)
                const request = store.get(name)
                request.onsuccess = () => resolve(request.result as string || null)
                request.onerror = () => reject(request.error)
            })
        } catch (e) {
            console.warn('[IndexedDB] Failed to get item:', e)
            return null
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        return queueIndexedDbWrite(name, value)
    },
    removeItem: async (name: string): Promise<void> => {
        const pending = pendingWrites.get(name)
        if (pending) {
            if (pending.timer !== null) {
                window.clearTimeout(pending.timer)
            }
            pending.rejectors.forEach((reject) => reject(new Error(`Write for ${name} was cancelled by removeItem`)))
            pendingWrites.delete(name)
        }

        const db = await dbPromise
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.delete(name)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    },
}

/**
 * Migration helper to move data from LocalStorage to IndexedDB
 */
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
    for (const key of keys) {
        try {
            const localData = localStorage.getItem(key)
            if (!localData) continue

            // Check if already in IDB
            const indexedData = await indexedDBStorage.getItem(key)
            if (indexedData) {
                console.log(`[Migration] ${key} already exists in IDB. Clearing LocalStorage.`)
                localStorage.removeItem(key)
                continue
            }

            console.log(`[Migration] Moving ${key} to IndexedDB...`)
            await indexedDBStorage.setItem(key, localData)
            
            // Verify
            const check = await indexedDBStorage.getItem(key)
            if (check) {
                localStorage.removeItem(key)
                console.log(`[Migration] ${key} migrated successfully.`)
            }
        } catch (e) {
            console.error(`[Migration] Failed to migrate ${key}:`, e)
        }
    }
}

async function flushPendingWrite(name: string): Promise<void> {
    const pending = pendingWrites.get(name)
    if (!pending) return

    if (pending.timer !== null) {
        window.clearTimeout(pending.timer)
        pending.timer = null
    }

    pendingWrites.delete(name)

    try {
        const db = await dbPromise
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.put(pending.value, name)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })

        pending.resolvers.forEach((resolve) => resolve())
    } catch (error) {
        pending.rejectors.forEach((reject) => reject(error))
        throw error
    }
}

function queueIndexedDbWrite(name: string, value: string): Promise<void> {
    const debounceMs = WRITE_DEBOUNCE_MS[name] ?? 250
    const now = Date.now()
    const existing = pendingWrites.get(name)

    return new Promise<void>((resolve, reject) => {
        const pending: PendingWrite = existing ?? {
            value,
            timer: null,
            queuedAt: now,
            resolvers: [],
            rejectors: [],
        }

        pending.value = value
        pending.resolvers.push(resolve)
        pending.rejectors.push(reject)

        if (!existing) {
            pending.queuedAt = now
            pendingWrites.set(name, pending)
        }

        if (pending.timer !== null) {
            window.clearTimeout(pending.timer)
        }

        const elapsed = now - pending.queuedAt
        const delay = elapsed >= MAX_PENDING_MS ? 0 : Math.min(debounceMs, MAX_PENDING_MS - elapsed)

        pending.timer = window.setTimeout(() => {
            flushPendingWrite(name).catch((error) => {
                console.error(`[IndexedDB] Failed to flush ${name}:`, error)
            })
        }, delay)
    })
}

if (typeof window !== 'undefined') {
    const flushAllPendingWrites = () => {
        for (const key of [...pendingWrites.keys()]) {
            flushPendingWrite(key).catch((error) => {
                console.error(`[IndexedDB] Failed to flush ${key} during shutdown:`, error)
            })
        }
    }

    window.addEventListener('beforeunload', flushAllPendingWrites)
    window.addEventListener('pagehide', flushAllPendingWrites)
}
