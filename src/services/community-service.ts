
export interface CommunityArtist {
    id: string;
    name: string;
    author_name: string;
    description: string;
    tag: string;
    preview_base64?: string;
    preview_url?: string;
    created_at: number;
    downloads: number;
}

export interface CommunityWildcard {
    id: string;
    name: string;
    author_name: string;
    description: string;
    tags: string;
    content?: string;
    created_at: number;
    downloads: number;
}

const WORKER_URL = "https://nais2-sync-worker.liuanjay.workers.dev";

export class CommunityService {

    // --- Artists ---

    async listArtists(limit = 20, offset = 0, search = "", sort = "newest"): Promise<CommunityArtist[]> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            search,
            sort
        });

        try {
            const res = await fetch(`${WORKER_URL}/artists?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.artists || [];
            }
        } catch (e) {
            console.error("Failed to list community artists", e);
        }
        return [];
    }

    async publishArtist(token: string, artistData: {
        name: string,
        description: string,
        tag: string,
        preview_base64?: string,
        preview_url?: string
    }): Promise<{ success: boolean, id?: string, error?: string }> {
        try {
            const res = await fetch(`${WORKER_URL}/artists/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(artistData)
            });

            if (res.ok) {
                return await res.json();
            } else {
                const text = await res.text();
                return { success: false, error: text };
            }
        } catch (e: any) {
            return { success: false, error: e.message || "Network error" };
        }
    }

    async getArtistDetails(id: string): Promise<CommunityArtist | null> {
         try {
            const res = await fetch(`${WORKER_URL}/artists/${id}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.error("Failed to get artist details", e);
        }
        return null;
    }

    // --- Wildcards ---

    async listWildcards(limit = 20, offset = 0, search = "", sort = "newest"): Promise<CommunityWildcard[]> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            search,
            sort
        });

        try {
            const res = await fetch(`${WORKER_URL}/wildcards?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                return data.wildcards || [];
            }
        } catch (e) {
            console.error("Failed to list community wildcards", e);
        }
        return [];
    }

    async publishWildcard(token: string, data: {
        name: string,
        description: string,
        tags: string,
        content: string
    }): Promise<{ success: boolean, id?: string, error?: string }> {
        try {
            const res = await fetch(`${WORKER_URL}/wildcards/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                return await res.json();
            } else {
                const text = await res.text();
                return { success: false, error: text };
            }
        } catch (e: any) {
            return { success: false, error: e.message || "Network error" };
        }
    }

    async getWildcardDetails(id: string): Promise<CommunityWildcard | null> {
         try {
            const res = await fetch(`${WORKER_URL}/wildcards/${id}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.error("Failed to get wildcard details", e);
        }
        return null;
    }
}

export const communityService = new CommunityService();
