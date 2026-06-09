import Database from '@tauri-apps/plugin-sql';
import { fromByteArray } from 'base64-js';
import { presetDB } from './preset-db';
import { wildcardDB } from './wildcard-db';
import { usePresetStore } from '../stores/preset-store';
import { useArtistStore } from '../stores/artist-store';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';


const DB_PATH = "sqlite:data.db";

export interface SyncChange {
    key: string;
    value: string;
    updated_at: number;
    deleted: boolean;
}

export interface RemoteSyncResponse {
    changes: SyncChange[];
    timestamp: number;
}

// Artist Interface matching DB schema
interface LocalArtist {
    id: number;
    name: string;
    count: number;
    last_modified: string | number; 
    preview_image: string | number[] | Uint8Array | null;
    tag?: string;
    is_favorite?: number; // SQLite uses 0/1
    description?: string;
    preview_url?: string;
}

export class CloudSyncService {
    private db: Database | null = null;

    constructor() {
        this.init();
    }

    async init() {
        if (!this.db) {
            this.db = await Database.load(DB_PATH);
            // 启用 WAL 模式：允许读写并发，彻底解决 Android 上 "database is locked" (code 5)
            await this.db.execute("PRAGMA journal_mode=WAL;");
            // 设置 busy_timeout：遇到锁时自动等待 5 秒而不是立即报错
            await this.db.execute("PRAGMA busy_timeout=5000;");
        }
    }

    // --- PULL LOGIC ---

    async mergeRemoteChanges(changes: SyncChange[]) {
        await this.init();
        if (!this.db) throw new Error("DB not initialized");

        // 注意：不使用显式事务。WAL 模式下每条语句自带原子性，
        // 而长事务会持有写锁直到 COMMIT，导致 Android 上 database is locked。
        // 跨 DB 连接 (presetDB/wildcardDB) 的操作也不在事务保护范围内。

        try {
            for (const change of changes) {
                // Key format: "artist:{id}" or "preset:{id}"
                
                if (change.key.startsWith("preset:")) {
                    const presetId = change.key.split(":")[1];
                    
                    if (change.deleted) {
                         await presetDB.deletePreset(presetId);
                    } else {
                         try {
                             const presetData = JSON.parse(change.value);
                             // Ensure ID matches key
                             presetData.id = presetId;
                             await presetDB.addPreset(presetData);
                         } catch (e) {
                             console.error(`Failed to parse sync data for ${change.key}`, e);
                         }
                    }
                }
                else if (change.key.startsWith("artist:")) {
                    const artistId = parseInt(change.key.split(":")[1]);
                    
                    if (change.deleted) {
                        await this.db.execute("DELETE FROM artists WHERE id = $1", [artistId]);
                    } else {
                        // Parse Value
                        let artistData: Partial<LocalArtist> = {};
                        try {
                            artistData = JSON.parse(change.value);
                        } catch (e) {
                            console.error(`Failed to parse sync data for ${change.key}`, e);
                            continue;
                        }

                        // Check duplicate name logic (KEEP EXISTING OPTIMIZATION)
                        const name = artistData.name || "Unknown";
                        const count = artistData.count || 0;
                        const lastMod = change.updated_at;
                        const tag = artistData.tag || null;

                        // OPTIMIZATION: Check for duplicate name with different ID
                        const existingDuplicate = await this.db.select<any[]>(
                            "SELECT id FROM artists WHERE name = $1 AND id != $2", 
                            [name, artistId]
                        );

                        if (existingDuplicate.length > 0) {
                            console.log(`[CloudSync] Skipping duplicate artist "${name}" (Remote ID: ${artistId}, Local ID: ${existingDuplicate[0].id})`);
                            continue;
                        }

                        // Determine image value
                        let imageValue: any = null; // ALWAYS NULL ON MOBILE TO PREVENT SQL PLUGIN CRASH
                        let previewUrl = artistData.preview_url || null;
                        let imageBytesToSave: Uint8Array | null = null;
                        
                        const isAndroid = /android/i.test(navigator.userAgent);
                        
                        if (isAndroid) {
                            // ===== MOBILE FAST PATH =====
                            // On Android, NEVER download/decode image blobs.
                            // Just keep the remote https:// preview_url directly.
                            // base64 and local:// files are PC-only concerns.
                            if (previewUrl && previewUrl.startsWith('local://')) {
                                previewUrl = null; // Discard PC-only local file references
                            }
                            // If we have base64 image but no URL, try to at least get a Danbooru URL
                            // (this will be handled lazily by ArtistCard's onError fallback)
                            console.log(`[CloudSync][Android] Artist ${artistId}: keeping previewUrl=${previewUrl || 'none'}, skipping blob/download`);
                        } else {
                            // ===== DESKTOP PATH (original logic) =====
                            if (artistData.preview_image) {
                                 if (typeof artistData.preview_image === 'string') {
                                     try {
                                         const base64Str = artistData.preview_image.includes(',') 
                                            ? artistData.preview_image.split(',')[1] 
                                            : artistData.preview_image;
                                         
                                         const binaryString = atob(base64Str);
                                         const len = binaryString.length;
                                         const bytes = new Uint8Array(len);
                                         for (let i = 0; i < len; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                         }
                                         imageBytesToSave = bytes;
                                     } catch (e) {
                                         console.warn("Failed to decode image for sync", e);
                                     }
                                 }
                            } else if (artistData.preview_url && !artistData.preview_url.startsWith('local://')) {
                                // Fetch URL and save as local file
                                try {
                                    console.log(`[CloudSync] Fetching preview from URL for artist ${artistId}: ${artistData.preview_url}`);
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                                    const resp = await fetch(artistData.preview_url, { 
                                        referrerPolicy: 'no-referrer',
                                        signal: controller.signal
                                    });
                                    clearTimeout(timeoutId);
                                    if (resp.ok) {
                                        const blob = await resp.blob();
                                        const buffer = await blob.arrayBuffer();
                                        imageBytesToSave = new Uint8Array(buffer);
                                        console.log(`[CloudSync] Downloaded and cached image (${imageBytesToSave.length} bytes)`);
                                    } else {
                                        console.warn(`[CloudSync] Failed to fetch preview URL: ${resp.status}`);
                                    }
                                } catch (e) {
                                    console.error(`[CloudSync] Error fetching preview URL:`, e);
                                }
                            }
                        }
                        
                        // Save image to filesystem instead of DB blob (fixes Android Sqlite plugin crash)
                        if (imageBytesToSave && imageBytesToSave.length > 0) {
                             try {
                                 const baseDir = await join(await appDataDir(), 'artist_thumbnails');
                                 if (!(await exists(baseDir))) {
                                     await mkdir(baseDir, { recursive: true });
                                 }
                                 const fileName = `${artistId}.png`;
                                 await writeFile(await join(baseDir, fileName), imageBytesToSave);
                                 // Stop destructive override of Danbooru URLs to local:// in the database
                                 if (!previewUrl || previewUrl.startsWith('local://') || previewUrl.startsWith('data:')) {
                                     previewUrl = `local://${fileName}`;
                                 }
                             } catch(e) {
                                 console.error('[CloudSync] Failed to write image blob to fs:', e);
                             }
                        }
                        
                        // Handle is_favorite: might come as boolean or number
                        let isFav = 0;
                        if (typeof artistData.is_favorite === 'boolean') isFav = artistData.is_favorite ? 1 : 0;
                        else if (typeof artistData.is_favorite === 'number') isFav = artistData.is_favorite;

                        const desc = artistData.description || null;

                        // Manual UPSERT using name to avoid ID conflicts across devices
                        const existing = await this.db.select<any[]>('SELECT id FROM artists WHERE name = $1 LIMIT 1', [name]);
                        if (existing.length > 0) {
                            await this.db.execute(
                                `UPDATE artists SET 
                                    count = $1, last_modified = $2, preview_image = COALESCE($3, preview_image),
                                    tag = $4, is_favorite = $5, description = $6, preview_url = $7
                                 WHERE id = $8`,
                                [count, lastMod, imageValue, tag, isFav, desc, previewUrl, existing[0].id]
                            );
                        } else {
                            await this.db.execute(
                                `INSERT INTO artists (name, count, last_modified, preview_image, tag, is_favorite, description, preview_url) 
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                                [name, count, lastMod, imageValue, tag, isFav, desc, previewUrl]
                            );
                        }
                    }
                }
                else if (change.key.startsWith("wildcard:")) {
                    const wildcardId = change.key.split(":")[1];
                    
                    if (change.deleted) {
                         // Soft delete or hard delete? DB supports soft via 'deleted' flag, but if remote says deleted...
                         // Usually we just mark deleted = 1
                         await wildcardDB.addOrUpdateWildcard({
                             id: wildcardId,
                             name: "", 
                             content: "",
                             collection: "",
                             createdAt: 0,
                             updatedAt: change.updated_at,
                             deleted: true
                         });
                    } else {
                         try {
                             const data = JSON.parse(change.value);
                             // Ensure ID matches
                             data.id = wildcardId;
                             // Map back JSON to DB format if needed (date strings to numbers?)
                             // My DB uses numbers, JSON might have them as numbers if I sent them as numbers.
                             // In getLocalChanges I sent them as... numbers (createdAt: row.created_at).
                             // So it should be fine.
                             await wildcardDB.addOrUpdateWildcard(data);
                         } catch (e) {
                             console.error(`Failed to parse sync data for ${change.key}`, e);
                         }
                    }
                }
            }

            // Merge 完成后刷新前台 UI
            usePresetStore.getState().init();
            useArtistStore.getState().loadArtists();

        } catch (e) {
            throw e;
        }
    }

    // --- PUSH LOGIC ---

    async getLocalChanges(lastSyncTime: number): Promise<SyncChange[]> {
        await this.init();
        if (!this.db) throw new Error("DB not initialized");

        const changes: SyncChange[] = [];

        // 1. Artists
        const artistRows = await this.db.select<any[]>("SELECT * FROM artists");
        
        for (const row of artistRows) {
            let modTime = 0;
            // Parse modifier
            if (typeof row.last_modified === 'number') {
                modTime = row.last_modified;
            } else if (typeof row.last_modified === 'string') {
                const parsed = Date.parse(row.last_modified);
                if (!isNaN(parsed)) modTime = parsed;
            }

            // Fallback for old records created before 'last_modified' was added
            if (modTime === 0) {
                modTime = row.created_at ? (typeof row.created_at === 'number' ? row.created_at : Date.parse(row.created_at) || 1) : 1;
            }

            // Only sync if newer than lastSyncTime
            if (modTime > lastSyncTime) {
                // Convert Image blob to Base64 for JSON transport
                let imgBase64: string | null = null;
                
                if (row.preview_image && !row.preview_url) {
                    try {
                        let bytes: Uint8Array;
                        if (row.preview_image instanceof Uint8Array) {
                            bytes = row.preview_image;
                        } else if (Array.isArray(row.preview_image)) {
                            bytes = new Uint8Array(row.preview_image);
                        } else {
                             bytes = new Uint8Array([]); 
                        }

                        if (bytes.length > 0) {
                             imgBase64 = fromByteArray(bytes);
                        }
                    } catch (e) {
                         console.warn("Failed to convert image for sync", e);
                    }
                }

                const dataPayload = {
                    id: row.id,
                    name: row.name,
                    count: row.count,
                    preview_image: imgBase64, // Send generic base64
                    tag: row.tag || undefined,
                    is_favorite: row.is_favorite === 1 ? true : false,
                    description: row.description || undefined,
                    preview_url: row.preview_url?.startsWith('local://') ? undefined : (row.preview_url || undefined)
                };

                changes.push({
                    key: `artist:${row.id}`,
                    value: JSON.stringify(dataPayload),
                    updated_at: modTime,
                    deleted: false
                });
            }
        }

        // 2. Presets
        try {
             const presetRows = await this.db.select<any[]>("SELECT * FROM presets");
             for (const row of presetRows) {
                 const modTime = row.updated_at || row.created_at || 1;
                 if (modTime > lastSyncTime) {
                     let presetContent: any = {};
                     try {
                         presetContent = JSON.parse(row.data);
                     } catch (e) { continue; }

                     presetContent.name = row.name;
                     presetContent.createdAt = row.created_at;
                     presetContent.isDefault = Boolean(row.is_default);
                     
                     changes.push({
                         key: `preset:${row.id}`,
                         value: JSON.stringify(presetContent),
                         updated_at: modTime,
                         deleted: false 
                     });
                 }
             }
        } catch (e) {
            console.warn("Failed to sync presets (table may not exist yet)", e);
        }
        
        // 3. Wildcards
        try {
             const wildcardRows = await this.db.select<any[]>("SELECT * FROM wildcards");
             for (const row of wildcardRows) {
                 const modTime = row.updated_at || row.created_at || 1;
                 if (modTime > lastSyncTime) {
                     const dataPayload = {
                         id: row.id,
                         name: row.name,
                         content: row.content,
                         collection: row.collection,
                         createdAt: row.created_at,
                         updatedAt: row.updated_at,
                         deleted: Boolean(row.deleted)
                     };

                     changes.push({
                         key: `wildcard:${row.id}`,
                         value: JSON.stringify(dataPayload),
                         updated_at: modTime,
                         deleted: Boolean(row.deleted)
                     });
                 }
             }
        } catch (e) {
            console.warn("Failed to sync wildcards (table may not exist yet)", e);
        }
        
        return changes;
    }
}

export const cloudSyncService = new CloudSyncService();
