import { artistDB } from './artist-db';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const DANBOORU_API_BASE = "https://danbooru.donmai.us";

export class DanbooruService {

    /**
     * Replaces standard fetch with Tauri's native HTTP client to bypass CORS 
     * and spoof User-Agent (avoiding Cloudflare/Danbooru blocks).
     * Includes Exponential Backoff for 429 Too Many Requests.
     */
    private async requestDanbooru(url: string, retries = 3): Promise<any> {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await tauriFetch(url, {
                    method: 'GET',
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json"
                    },
                    connectTimeout: 10000
                });

                if (response.status === 429 || response.status === 403) {
                    const delay = 2000 * (i + 1);
                    console.log(`[Danbooru] HTTP ${response.status}, retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`Danbooru API returned ${response.status} for ${url}`);
                }

                return await response.json();
            } catch (e) {
                if (i === retries - 1) throw e;
                const delay = 2000 * (i + 1);
                console.log(`[Danbooru] Fetch failed, retrying in ${delay}ms...`, e);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        return null;
    }
    
    /**
     * Fetches a preview image URL for a given tag from Danbooru.
     * Uses a lightweight query to get the most recent safe/general post.
     */
    async fetchArtistPreview(tag: string): Promise<string | null> {
        try {
            const limit = 5; // Fetch a few posts so we can skip videos/unsuitable ones
            // 1. Try exact tag first
            let url = `${DANBOORU_API_BASE}/posts.json?tags=${encodeURIComponent(tag)}&limit=${limit}`;
            
            let posts = await this.requestDanbooru(url);
            
            // 2. If no posts and tag has 'artist:' prefix, try stripping it
            if ((!posts || posts.length === 0) && tag.startsWith('artist:')) {
                const cleanTag = tag.replace('artist:', '');
                console.log(`[Danbooru] No results for ${tag}, retrying with ${cleanTag}`);
                url = `${DANBOORU_API_BASE}/posts.json?tags=${encodeURIComponent(cleanTag)}&limit=${limit}`;
                posts = await this.requestDanbooru(url);
            }

            // 3. Also try replacing spaces with underscores if still no results
            if ((!posts || posts.length === 0) && tag.includes(' ')) {
                const underscored = tag.replace(/ /g, '_');
                console.log(`[Danbooru] No results, retrying with underscored: ${underscored}`);
                url = `${DANBOORU_API_BASE}/posts.json?tags=${encodeURIComponent(underscored)}&limit=${limit}`;
                posts = await this.requestDanbooru(url);
            }

            if (posts && posts.length > 0) {
                // Find the first suitable image post (skip videos, zip, etc.)
                for (const post of posts) {
                    const ext = post.file_ext || '';
                    // Skip video/animation formats that don't work as thumbnails
                    if (['mp4', 'webm', 'zip', 'swf'].includes(ext)) continue;
                    
                    // Try to pick the best variant: prefer ~720px wide thumbnail
                    const variants = post.media_asset?.variants;
                    if (variants && variants.length > 0) {
                        // Sort by width descending, pick the first one <= 720px
                        const sorted = [...variants]
                            .filter((v: any) => v.url && v.type === 'image')
                            .sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
                        const thumb = sorted.find((v: any) => (v.width || 0) <= 720) || sorted[sorted.length - 1];
                        if (thumb?.url) return thumb.url;
                    }
                    // Fallback to preview_file_url (medium res) > large_file_url > file_url
                    if (post.preview_file_url) return post.preview_file_url;
                    if (post.large_file_url) return post.large_file_url;
                    if (post.file_url) return post.file_url;
                }
            }
        } catch (e) {
            console.error(`[Danbooru] Failed to fetch preview for ${tag}`, e);
        }
        return null;
    }

    /**
     * Fetches a list of posts for a given tag.
     */
    async fetchArtistPosts(tag: string, limit: number = 20): Promise<any[]> {
        try {
            // Ensure we don't fetch explicit content if possible, or let user handle it?
            // For now, standard query.
            const url = `${DANBOORU_API_BASE}/posts.json?tags=${encodeURIComponent(tag)}&limit=${limit}`;
            const posts = await this.requestDanbooru(url);
            return posts || [];
        } catch (e) {
            console.error(`[Danbooru] Failed to fetch posts for ${tag}`, e);
            return [];
        }
    }

    /**
     * Iterates through all local artists. 
     * If an artist has no preview_url (or has a reset flag), tries to fetch it.
     */
    async batchUpdateArtistLinks(
        onProgress: (current: number, total: number, status: string) => void,
        shouldStop: () => boolean,
        forceUpdate = false
    ): Promise<void> {
        // Use Lite version to prevent OOM crash from loading all base64 images
        const allArtists = await artistDB.getAllArtistsLite();
        
        const targets = allArtists.filter(a => forceUpdate || !a.previewUrl);
        const total = targets.length;

        console.log(`[DanbooruService] All artists: ${allArtists.length}, Targets to update: ${total}`);

        let current = 0;
        for (const artist of targets) {
            if (shouldStop()) {
                console.log('[DanbooruService] Batch update stopped by user.');
                break;
            }

            current++;
            onProgress(current, total, `Updating ${artist.name}...`);

            // Use 'tag' or fallback to 'artist:name'
            let searchTag = artist.tag;
            // Clean up tag: if it contains commas, take the first one? No, Danbooru search usually takes one tag for 'artist'.
            // If it has "artist:foo", use that.
            if (!searchTag || searchTag.trim() === '') {
                 searchTag = `artist:${artist.name.trim().replace(/ /g, '_')}`;
            }

            console.log(`[DanbooruService] [${current}/${total}] Processing ${artist.name}. Search Tag: "${searchTag}"`);

            // Rate limiting: Increase to 1000ms to avoid Danbooru Cloudflare blocks / Android limits
            await new Promise(r => setTimeout(r, 1000));

            const url = await this.fetchArtistPreview(searchTag);
            
            if (url) {
                console.log(`[DanbooruService] -> Found URL for ${artist.name}: ${url}`);
                
                // Fetch the full artist only when we need to save it to avoid memory bloat
                const fullArtist = await artistDB.getArtist(artist.id);
                if (fullArtist) {
                    const updatedArtist = { ...fullArtist, previewUrl: url };
                    await artistDB.addArtist(updatedArtist);
                    console.log(`[DanbooruService] -> Database updated for ${artist.name}`);
                }
            } else {
                console.warn(`[DanbooruService] -> No URL found for ${artist.name} (Tag: ${searchTag})`);
            }
        }
        
        console.log('[DanbooruService] Batch update finished.');
        onProgress(total, total, "Done.");
    }

    /**
     * Specialized bulk operation for mobile/constrained devices:
     * Uses DIRECT SQL to find and fix all artists missing valid https:// preview URLs.
     * Safely updates in-place (no delete+re-insert). Also clears heavy blobs.
     */
    async batchPurgeAndFetchArtistLinks(
        onProgress: (current: number, total: number, status: string) => void,
        shouldStop: () => boolean
    ): Promise<void> {
        // Direct SQL query to find ALL artists needing repair:
        // - preview_url is NULL
        // - preview_url is empty
        // - preview_url starts with 'local://' (PC-only, useless on mobile)
        const Database = (await import('@tauri-apps/plugin-sql')).default;
        const db = await Database.load('sqlite:data.db');
        
        const targets = await db.select<any[]>(`
            SELECT id, name, tag, preview_url 
            FROM artists 
            WHERE preview_url IS NULL 
               OR preview_url = '' 
               OR preview_url LIKE 'local://%'
        `);
        
        const total = targets.length;
        console.log(`[DanbooruService] Batch repair: ${total} artists need URL fix`);

        if (total === 0) {
            onProgress(0, 0, 'All artists already have valid URLs!');
            return;
        }

        let current = 0;
        let fixed = 0;
        let failed = 0;

        for (const row of targets) {
            if (shouldStop()) {
                console.log('[DanbooruService] Batch repair stopped by user.');
                break;
            }

            current++;
            onProgress(current, total, `Processing: ${row.name} (${current}/${total})`);

            let searchTag = row.tag;
            if (!searchTag || searchTag.trim() === '') {
                searchTag = `artist:${row.name.trim().replace(/ /g, '_')}`;
            }

            await new Promise(r => setTimeout(r, 1000)); // 1s spacing between batches

            try {
                const url = await this.fetchArtistPreview(searchTag);
                
                if (url && url.startsWith('http')) {
                    // Direct SQL UPDATE: set preview_url and clear heavy blob
                    await db.execute(
                        `UPDATE artists SET preview_url = $1, preview_image = NULL WHERE id = $2`,
                        [url, row.id]
                    );
                    fixed++;
                    console.log(`[DanbooruService] ✅ Fixed: ${row.name} -> ${url}`);
                } else {
                    failed++;
                    console.log(`[DanbooruService] ❌ No image for ${row.name}. (Might be missing on Danbooru or blocked)`);
                }
            } catch (e) {
                failed++;
                console.error(`[DanbooruService] Error processing ${row.name}:`, e);
            }
        }
        
        console.log(`[DanbooruService] Batch repair done. Fixed: ${fixed}, Failed: ${failed}`);
        onProgress(total, total, `Done! Fixed ${fixed} artists. ${failed > 0 ? `${failed} images missing from Danbooru.` : ''}`);
    }
}

export const danbooruService = new DanbooruService();
