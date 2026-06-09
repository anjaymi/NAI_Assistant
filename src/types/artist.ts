export interface Artist {
    id: string;
    name: string;
    tag: string; // The prompt tag, e.g. "artist:foo"
    imageUrl: string; // Base64 or URL
    previewUrl?: string; // Optional: External URL (e.g. Danbooru)
    createdAt: number;
    danbooruCount?: number;
    isFavorite?: boolean;
    description?: string;
    memo?: string; // Private artist notes/memos
}

// Lightweight version for the list view (if we want to separate images, but for now we keep it simple)
// We allow imageUrl to be present (e.g. if it's a URL string), but it might be omitted if it's a huge blob we avoided loading.
export type ArtistLite = Omit<Artist, 'imageUrl'> & { imageUrl?: string; hasImage?: boolean };

// Extremely lightweight DTO exclusively for the Mobile UI rendering.
// Stripped of all local blob/file logic.
export interface MobileArtistDTO {
    id: string;
    name: string;
    tag: string;
    previewUrl: string | null;
    danbooruCount: number;
    isFavorite: boolean;
    memo?: string;
}

export interface ArtistStoreState {
    artists: Artist[];
    selectedArtists: Record<string, number>; // ID -> Weight (default 1.0)
    searchQuery: string;
    sortMode: 'default' | 'alpha-asc' | 'alpha-desc' | 'danbooru-desc' | 'danbooru-asc' | 'favorite' | 'date-desc';
    isDataLoading: boolean;
}

export type SortMode = ArtistStoreState['sortMode'];

export interface ArtistCombo {
    id: string;
    name: string;
    description?: string;
    prompt: string; // The full string (e.g. "1.0::artist:A::, 0.8::artist:B::")
    createdAt: number;
}
