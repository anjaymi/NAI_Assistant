import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { open } from '@tauri-apps/plugin-dialog'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { wildcardDB, WildcardItem } from '../services/wildcard-db'
import { generateUUID } from '@/lib/utils'


export interface WildcardFile {
    id: string
    name: string
    path: string // collection/name for display
    content?: string 
    collection: string
}

interface WildcardState {
    rootPath: string | null
    files: WildcardFile[]
    setRootPath: (path: string) => void
    refreshFromDB: () => Promise<void>
    
    // Import actions
    importFromFolder: () => Promise<void>
    
    // CRUD
    readFile: (id: string) => Promise<string>
    saveFile: (id: string, content: string) => Promise<void>
    createFile: (name: string, collection?: string) => Promise<void>
    createFileFromContent: (name: string, content: string) => Promise<void>
    deleteFile: (id: string) => Promise<void>
}

// Helper to scan recursively
async function scanDirectory(path: string, collectionPrefix: string = ""): Promise<{name: string, path: string, collection: string, fullPath: string}[]> {
    const results: {name: string, path: string, collection: string, fullPath: string}[] = [];
    
    try {
        const entries = await readDir(path);
        for (const entry of entries) {
            if (entry.isFile && entry.name.endsWith('.txt')) {
                results.push({
                    name: entry.name,
                    path: collectionPrefix ? `${collectionPrefix}/${entry.name}` : entry.name,
                    collection: collectionPrefix,
                    fullPath: `${path}\\${entry.name}` // OS specific separator, assume Windows for now but could use join
                });
            } else if (entry.isDirectory) {
                const subCollection = collectionPrefix ? `${collectionPrefix}/${entry.name}` : entry.name;
                const subResults = await scanDirectory(`${path}\\${entry.name}`, subCollection);
                results.push(...subResults);
            }
        }
    } catch (e) {
        console.error("Failed to scan dir", path, e);
    }
    return results;
}

export const useWildcardStore = create<WildcardState>()(
    persist(
        (set, get) => ({
            rootPath: null,
            files: [],

            setRootPath: (path) => set({ rootPath: path }),

            refreshFromDB: async () => {
                try {
                    const items = await wildcardDB.getAllWildcards();
                    const files: WildcardFile[] = items.map(item => ({
                        id: item.id,
                        name: item.name,
                        path: item.collection ? `${item.collection}/${item.name}` : item.name,
                        content: item.content,
                        collection: item.collection
                    }));
                    set({ files });
                } catch (e) {
                    console.error("Failed to load wildcards from DB", e);
                }
            },

            importFromFolder: async () => {
                try {
                    const selected = await open({
                        directory: true,
                        multiple: false,
                        recursive: true,
                    })

                    if (selected && typeof selected === 'string') {
                        set({ rootPath: selected })
                        // Scan and Import
                        const scanResults = await scanDirectory(selected);
                        const now = Date.now();
                        
                        for (const file of scanResults) {
                            try {
                                const content = await readTextFile(file.fullPath);
                                // Check if exists (by name/collection) to update or create new
                                // Logic: prefer update if name+collection matches? 
                                // Actually, DB ID is UUID. If we import, we might duplicate if we blindly insert.
                                // Let's try to find existing by name/collection.
                                let existing = await wildcardDB.findByName(file.name, file.collection);
                                
                                const item: WildcardItem = {
                                    id: existing ? existing.id : generateUUID(),
                                    name: file.name,
                                    content: content,
                                    collection: file.collection,
                                    createdAt: existing ? existing.createdAt : now,
                                    updatedAt: now,
                                    deleted: false
                                };
                                await wildcardDB.addOrUpdateWildcard(item);
                            } catch (err) {
                                console.error(`Failed to import ${file.fullPath}`, err);
                            }
                        }
                        await get().refreshFromDB();
                    }
                } catch (error) {
                    console.error('Failed to import wildcards:', error)
                }
            },

            readFile: async (id) => {
                // In DB mode, we might already have content in 'files' list if we loaded all?
                // But for large content, we might fetch on demand.
                // Currently getAllWildcards fetches content too.
                const file = get().files.find(f => f.id === id);
                if (file?.content !== undefined) return file.content;
                
                // Fetch specific
                const item = await wildcardDB.getWildcard(id);
                return item?.content || "";
            },

            saveFile: async (id, content) => {
                const item = await wildcardDB.getWildcard(id);
                if (item) {
                    item.content = content;
                    item.updatedAt = Date.now();
                    await wildcardDB.addOrUpdateWildcard(item);
                    await get().refreshFromDB(); // Update UI
                }
            },

            createFile: async (name, collection = "") => {
                 if (!name.endsWith('.txt')) name += '.txt';
                 const existing = await wildcardDB.findByName(name, collection);
                 const now = Date.now();
                 const newItem: WildcardItem = {
                     id: existing ? existing.id : generateUUID(),
                     name: name,
                     content: "",
                     collection: collection,
                     createdAt: existing ? existing.createdAt : now,
                     updatedAt: now,
                     deleted: false
                 };
                 await wildcardDB.addOrUpdateWildcard(newItem);
                 await get().refreshFromDB();
            },

            createFileFromContent: async (name, content) => {
                 if (!name.endsWith('.txt')) name += '.txt';
                 const existing = await wildcardDB.findByName(name, "");
                 const now = Date.now();
                 const newItem: WildcardItem = {
                     id: existing ? existing.id : generateUUID(),
                     name: name,
                     content: content,
                     collection: "",
                     createdAt: existing ? existing.createdAt : now,
                     updatedAt: now,
                     deleted: false
                 };
                 await wildcardDB.addOrUpdateWildcard(newItem);
                 await get().refreshFromDB();
            },
            
            deleteFile: async (id: string) => {
                 const item = await wildcardDB.getWildcard(id);
                 if (item) {
                     item.deleted = true;
                     item.updatedAt = Date.now();
                     await wildcardDB.addOrUpdateWildcard(item);
                     await get().refreshFromDB();
                 }
            }
        }),
        {
            name: 'wildcard-storage-v2', // Changed storage key to avoid conflict
            partialize: (state) => ({ rootPath: state.rootPath }),
        }
    )
)
