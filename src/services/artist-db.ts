import Database from '@tauri-apps/plugin-sql';
import type { Artist, ArtistLite, MobileArtistDTO } from '../types/artist';
import { fromByteArray, toByteArray } from 'base64-js';

const DB_PATH = "sqlite:data.db";

export class ArtistDB {
    private db: Database | null = null;

    private async init() {
        if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
            console.warn('[ArtistDB] Not running in Tauri environment. DB initialization skipped.');
            return null;
        }
        if (!this.db) {
            try {
                const { appConfigDir, join } = await import('@tauri-apps/api/path');
                const { BaseDirectory, exists, copyFile, mkdir } = await import('@tauri-apps/plugin-fs');
                
                const configDir = await appConfigDir();
                if (!(await exists(configDir))) {
                    await mkdir(configDir, { recursive: true });
                }
                
                const targetPath = await join(configDir, 'data.db');
                if (!(await exists(targetPath))) {
                    console.log('[ArtistDB] Local database not found. Copying from resources...');
                    try {
                        await copyFile('resources/data.db', targetPath, {
                            fromPathBaseDir: BaseDirectory.Resource
                        });
                        console.log('[ArtistDB] Successfully copied resources/data.db to config dir.');
                    } catch (copyErr) {
                        console.warn('[ArtistDB] Failed to copy resources/data.db. A new blank database will be created.', copyErr);
                    }
                }
                
                this.db = await Database.load(`sqlite:${targetPath}`);
            } catch (e) {
                console.error('[ArtistDB] DB initialization error, falling back to default:', e);
                this.db = await Database.load(DB_PATH);
            }
            
            await this.ensureSchema();
            // Wait for migration to finish so it blocks subsequent DB access
            // This prevents data races where UI updates a record that's concurrently being migrated
            await this.migrateBlobsToFs().catch(console.error);
        }
        return this.db;
    }

    private async migrateBlobsToFs() {
        if (!this.db) return;
        try {
            const { appDataDir, join } = await import('@tauri-apps/api/path');
            const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
            
            // Check if we have Blob Data that needs migration
            const rowsToMigrate = await this.db.select<any[]>(`
                SELECT id, preview_image 
                FROM artists 
                WHERE preview_image IS NOT NULL AND length(preview_image) > 0
            `);

            if (rowsToMigrate.length === 0) {
                return; // Nothing to migrate
            }

            console.log(`[ArtistDB] Starting migration of ${rowsToMigrate.length} artist blobs to filesystem...`);
            
            const baseDir = await join(await appDataDir(), 'artist_thumbnails');
            if (!(await exists(baseDir))) {
                await mkdir(baseDir, { recursive: true });
            }

            let migratedCount = 0;
            
            for (const row of rowsToMigrate) {
                try {
                    let bytes: Uint8Array | null = null;
                    if (typeof row.preview_image === 'string') {
                        const trimmed = row.preview_image.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            bytes = new Uint8Array(JSON.parse(trimmed));
                        } else {
                            const b64 = trimmed.split(',').pop() || trimmed;
                            bytes = toByteArray(b64);
                        }
                    } else if (row.preview_image) {
                        bytes = row.preview_image instanceof Uint8Array 
                            ? row.preview_image 
                            : new Uint8Array(row.preview_image as number[]);
                    }

                    if (bytes && bytes.length > 0) {
                        const fileName = `${row.id}.png`;
                        const filePath = await join(baseDir, fileName);
                        
                        await writeFile(filePath, bytes);
                        
                        await this.db.execute(`
                            UPDATE artists 
                            SET preview_url = $1, preview_image = NULL
                            WHERE id = $2
                        `, [`local://${fileName}`, row.id]);
                        
                        migratedCount++;
                    }
                } catch (e) {
                    console.warn(`[ArtistDB] Failed to migrate image for artist ${row.id}:`, e);
                }
            }

            console.log(`[ArtistDB] Successfully migrated ${migratedCount} artist blobs to filesystem.`);
            
            if (migratedCount > 0) {
                await this.db.execute("VACUUM");
                console.log(`[ArtistDB] Vacuumed database.`);
            }

        } catch (e) {
            console.error('[ArtistDB] Error during blob migration:', e);
        }
    }

    private async ensureSchema() {
        if (!this.db) return;
        
        // Ensure the base table exists before applying any column checks
        try {
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS artists (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    count INTEGER DEFAULT 0,
                    last_modified INTEGER,
                    preview_image BLOB,
                    tag TEXT,
                    is_favorite INTEGER DEFAULT 0,
                    description TEXT,
                    preview_url TEXT
                )
            `);
            console.log('[ArtistDB] Ensured base artists table exists.');
        } catch (e) {
            console.error('[ArtistDB] Failed to create base table:', e);
        }

        // First, check existing columns
        const tableInfo = await this.db.select<any[]>("PRAGMA table_info(artists)");
        const existingColumns = new Set(tableInfo.map(col => col.name));
        console.log('[ArtistDB] Existing columns:', Array.from(existingColumns));
        
        // Define required columns
        const requiredColumns = [
            { name: 'tag', definition: 'TEXT' },
            { name: 'is_favorite', definition: 'INTEGER DEFAULT 0' },
            { name: 'description', definition: 'TEXT' },
            { name: 'preview_url', definition: 'TEXT' },
            { name: 'created_at', definition: 'INTEGER' },
            { name: 'memo', definition: 'TEXT' }
        ];
        
        for (const col of requiredColumns) {
            if (!existingColumns.has(col.name)) {
                try {
                    console.log(`[ArtistDB] Adding missing column: ${col.name}`);
                    await this.db.execute(`ALTER TABLE artists ADD COLUMN ${col.name} ${col.definition}`);
                    console.log(`[ArtistDB] Successfully added column: ${col.name}`);
                    
                    if (col.name === 'created_at') {
                        // Backfill created_at with last_modified for existing records
                        await this.db.execute(`UPDATE artists SET created_at = last_modified WHERE created_at IS NULL`);
                        console.log(`[ArtistDB] Backfilled created_at from last_modified`);
                    }
                } catch (e) {
                    console.error(`[ArtistDB] Failed to add column ${col.name}:`, e);
                }
            }
        }
        
        // Populate tag column if it exists but is empty
        if (existingColumns.has('tag') || requiredColumns.some(c => c.name === 'tag')) {
            try {
                await this.db.execute(`UPDATE artists SET tag = 'artist:' || replace(name, ' ', '_') WHERE tag IS NULL OR tag = ''`);
                console.log('[ArtistDB] Populated empty tag values');
            } catch (e) {
                console.error('[ArtistDB] Error populating tag values:', e);
            }
        }

        // Ensure legacy artists without last_modified are backfilled so they can be synced to cloud
        try {
            const now = Date.now();
            await this.db.execute(`UPDATE artists SET last_modified = $1 WHERE last_modified IS NULL OR last_modified = 0`, [now]);
            console.log('[ArtistDB] Backfilled missing last_modified values');
        } catch (e) {
            console.error('[ArtistDB] Error backfilling last_modified:', e);
        }
    }



    // Helper to map DB row to Artist object
    private async rowToArtist(row: any): Promise<Artist> {
        let imageUrl = '';
        const isAndroid = /android/i.test(navigator.userAgent);

        if (isAndroid) {
            // MOBILE FAST PATH: Skip local file lookups and blob decoding entirely.
            // Only use direct https:// preview_url if available.
            if (row.preview_url && !row.preview_url.startsWith('local://')) {
                imageUrl = row.preview_url;
            }
            // else: imageUrl stays '' → card will show placeholder
        } else {
            const { appDataDir, join } = await import('@tauri-apps/api/path');
            const { convertFileSrc } = await import('@tauri-apps/api/core');
            const { exists } = await import('@tauri-apps/plugin-fs');
            const thumbDir = await join(await appDataDir(), 'artist_thumbnails');
            const sep = navigator.userAgent.includes('Win') ? '\\' : '/';

            let targetFileName = row.id + '.png';
            if (row.preview_url && row.preview_url.startsWith('local://')) {
                targetFileName = row.preview_url.replace('local://', '');
            }
            const cachedPath = `${thumbDir}${sep}${targetFileName}`;

            if (await exists(cachedPath)) {
                imageUrl = convertFileSrc(cachedPath);
            } else if (row.preview_image) {
                try {
                    if (typeof row.preview_image === 'string') {
                        const trimmed = row.preview_image.trim();
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            try {
                                const bytes = JSON.parse(trimmed);
                                if (Array.isArray(bytes)) {
                                    const u8 = new Uint8Array(bytes);
                                    const b64 = fromByteArray(u8);
                                    imageUrl = `data:image/png;base64,${b64}`;
                                } else {
                                    imageUrl = row.preview_image;
                                }
                            } catch (e) {
                                 imageUrl = row.preview_image;
                            }
                        } else {
                            imageUrl = row.preview_image;
                        }
                    } else {
                        const bytes = row.preview_image instanceof Uint8Array 
                            ? row.preview_image 
                            : new Uint8Array(row.preview_image as number[]);
                        
                        const b64 = fromByteArray(bytes);
                        imageUrl = `data:image/png;base64,${b64}`;
                    }
                } catch (e) {
                    console.error("Failed to decode image for artist " + row.id, e);
                }
            } else if (row.preview_url && !row.preview_url.startsWith('local://')) {
                imageUrl = row.preview_url;
            }
        }

        return {
            id: String(row.id),
            name: row.name,
            tag: row.tag || `artist:${row.name.replace(/ /g, '_')}`, // Fallback tag generation
            imageUrl: imageUrl,
            previewUrl: (row.preview_url && !row.preview_url.startsWith('local://')) ? row.preview_url : undefined,
            createdAt: row.created_at ? (typeof row.created_at === 'number' ? row.created_at : Date.parse(row.created_at)) : (row.last_modified ? (typeof row.last_modified === 'number' ? row.last_modified : Date.parse(row.last_modified) || 0) : 0),
            danbooruCount: row.count,
            isFavorite: Boolean(row.is_favorite),
            description: row.description || undefined,
            memo: row.memo || undefined
        };
    }

    public async getDB(): Promise<Database> {
        if (!this.db) await this.init();
        if (!this.db) throw new Error("Database failed to initialize");
        return this.db;
    }

    async addArtist(artist: Artist): Promise<void> {
        const db = await this.getDB();
        
        // Convert Image to BLOB (Uint8Array)
        let imageBlob: Uint8Array | null = null;
        let previewUrlToSave = artist.previewUrl || null;

        const now = Date.now();
        const id = parseInt(artist.id) || Date.now();

        if (artist.imageUrl) {
            if (artist.imageUrl.startsWith('http')) {
                // Keep URL as is
                previewUrlToSave = artist.previewUrl || artist.imageUrl;
            } else if (artist.imageUrl.startsWith('asset://')) {
                // Keep the original local file identifier to decouple storage paths across devices
                previewUrlToSave = artist.previewUrl || `local://${id}.png`;
            } else {
                try {
                    const b64 = artist.imageUrl.split(',')[1] || artist.imageUrl; // Strip header
                    const bytes = toByteArray(b64);
                    
                    const { appDataDir, join } = await import('@tauri-apps/api/path');
                    const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
                    const baseDir = await join(await appDataDir(), 'artist_thumbnails');
                    
                    if (!(await exists(baseDir))) {
                        await mkdir(baseDir, { recursive: true });
                    }
                    
                    const fileName = `${id}.png`;
                    await writeFile(await join(baseDir, fileName), bytes);
                    
                    previewUrlToSave = `local://${fileName}`;
                } catch (e) {
                    console.error("Failed to encode image for DB", e);
                }
            }
        }

        let dbId: number | null = parseInt(artist.id);
        if (isNaN(dbId)) dbId = null; // Auto-increment if null
        
        await db.execute(
            `INSERT INTO artists (id, name, tag, count, created_at, last_modified, preview_image, is_favorite, description, preview_url, memo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                tag = excluded.tag,
                count = excluded.count,
                last_modified = excluded.last_modified,
                preview_image = excluded.preview_image,
                is_favorite = excluded.is_favorite,
                description = excluded.description,
                preview_url = excluded.preview_url,
                memo = excluded.memo
            `,
            [
                id, 
                artist.name, 
                artist.tag, 
                artist.danbooruCount || 0, 
                artist.createdAt || now, 
                now, // last_modified ALWAYS updates to now()
                imageBlob, 
                artist.isFavorite ? 1 : 0, 
                artist.description || null,
                previewUrlToSave,
                artist.memo || null
            ]
        );
    }

    async deleteArtist(id: string): Promise<void> {
        const db = await this.getDB();
        await db.execute("DELETE FROM artists WHERE id = $1", [parseInt(id)]);
        // Should we mark as deleted instead for Sync? 
        // Sync logic handles deletions via explicit 'deleted' flag or we need a tombstone table.
        // For now, hard delete. Sync might miss deletions if we don't track them.
        // TODO: Implement soft delete for robust sync.
    }

    async updateArtist(artist: Artist): Promise<void> {
        return this.addArtist(artist);
    }

    async getArtist(id: string): Promise<Artist | undefined> {
        const db = await this.getDB();
        const rows = await db.select<any[]>("SELECT * FROM artists WHERE id = $1", [parseInt(id)]);
        if (rows.length > 0) {
            return await this.rowToArtist(rows[0]);
        }
        return undefined;
    }

    async getAllArtists(): Promise<Artist[]> {
        const db = await this.getDB();
        const rows = await db.select<any[]>("SELECT * FROM artists");
        return Promise.all(rows.map(r => this.rowToArtist(r)));
    }

    async getAllArtistsLite(): Promise<ArtistLite[]> {
        const db = await this.getDB();
        
        const rows = await db.select<any[]>(`
            SELECT id, name, tag, count, last_modified, created_at, is_favorite, description, preview_url, memo,
            (CASE WHEN preview_image IS NOT NULL AND length(preview_image) > 0 THEN 1 ELSE 0 END) as has_image
            FROM artists
        `);
        
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const thumbDir = await join(await appDataDir(), 'artist_thumbnails');
        const sep = navigator.userAgent.includes('Win') ? '\\' : '/';
        
        const isAndroid = /android/i.test(navigator.userAgent);
        
        return rows.map(row => {
            let imageUrl: string | undefined = undefined;
            
            if (row.preview_url?.startsWith('local://')) {
                if (isAndroid) {
                    // On Android, local:// files DON'T EXIST (they live on PC only).
                    // Skip the doomed asset URL conversion entirely.
                    // Fall through to use preview_url https or Danbooru fallback.
                    imageUrl = undefined;
                } else {
                    const fileName = row.preview_url.replace('local://', '');
                    imageUrl = convertFileSrc(`${thumbDir}${sep}${fileName}`);
                }
            } else if (row.has_image) {
                // has blob, leave undefined so ArtistCard fetches full blob
                imageUrl = undefined;
            } else if (row.preview_url) {
                imageUrl = row.preview_url;
            }

            // On Android, if we have a valid https preview_url, always prefer it as imageUrl
            // This ensures the card can display something immediately.
            if (isAndroid && !imageUrl && row.preview_url && !row.preview_url.startsWith('local://')) {
                imageUrl = row.preview_url;
            }

            return {
                id: String(row.id),
                name: row.name,
                tag: row.tag || `artist:${row.name.replace(/ /g, '_')}`,
                createdAt: row.created_at ? (typeof row.created_at === 'number' ? row.created_at : Date.parse(row.created_at)) : (row.last_modified ? (typeof row.last_modified === 'number' ? row.last_modified : Date.parse(row.last_modified) || 0) : 0),
                danbooruCount: row.count,
                isFavorite: Boolean(row.is_favorite),
                description: row.description || undefined,
                memo: row.memo || undefined,
                previewUrl: (row.preview_url && !row.preview_url.startsWith('local://')) ? row.preview_url : undefined,
                hasImage: Boolean(row.has_image),
                imageUrl: imageUrl 
            };
        });
    }
    
    /**
     * Mobile-specific raw data fetcher. 
     * Completely bypasses any local file or blob decoding logic.
     * Returns ONLY valid remote https instances or null.
     */
    async getMobileArtistsLite(): Promise<MobileArtistDTO[]> {
        const db = await this.getDB();
        if (!db) return [];
        
        try {
            const rows = await db.select<any[]>(`
                SELECT id, name, tag, count, is_favorite, preview_url, memo
                FROM artists
                ORDER BY last_modified DESC
            `);

            return rows.map(row => {
                let finalUrl: string | null = null;
                
                if (row.preview_url && !row.preview_url.startsWith('local://')) {
                    finalUrl = row.preview_url;
                }
                
                return {
                    id: String(row.id),
                    name: row.name,
                    tag: row.tag || `artist:${row.name.replace(/ /g, '_')}`,
                    previewUrl: finalUrl,
                    danbooruCount: row.count || 0,
                    isFavorite: Boolean(row.is_favorite),
                    memo: row.memo || undefined
                };
            });
        } catch (e) {
            console.error("Failed to fetch mobile artists lite:", e);
            return [];
        }
    }

    async bulkAddArtists(artists: Artist[]): Promise<void> {
        const db = await this.getDB();
        await db.execute("BEGIN TRANSACTION");
        try {
            for (const artist of artists) {
                await this.addArtist(artist);
            }
            await db.execute("COMMIT");
        } catch (e) {
            await db.execute("ROLLBACK");
            throw e;
        }
    }
    
    async clearAll(): Promise<void> {
        const db = await this.getDB();
        await db.execute("DELETE FROM artists");
    }
}

export const artistDB = new ArtistDB();
