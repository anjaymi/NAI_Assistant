import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from '@/lib/indexed-db';
import { Artist, ArtistLite, SortMode, ArtistCombo } from '../types/artist';
export type { Artist, ArtistLite, SortMode, ArtistCombo };
import { artistDB } from '../services/artist-db';
import { generateUUID } from '@/lib/utils';

// --- 固定画师结构化类型 ---
export interface FixedArtistItem {
    id: string;
    tag: string;
    weight: number;
    year?: string;
    withYearPrefix?: boolean;
    /** 画师显示名（展示辅助，不影响 prompt 输出） */
    name?: string;
    /** 画师私人备注（展示辅助，不影响 prompt 输出） */
    memo?: string;
}

export function parseFixedArtistsString(text: string): FixedArtistItem[] {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split(/\n/).filter(l => l.trim());
    return lines.map((line, index) => {
        let fullTag = line.trim();

        // 提取年份
        let year: string | undefined;
        let withYearPrefix = true;
        const yearMatch = fullTag.match(/, (?:(year\s+)(\S+)|(20\d{2}|19\d{2}))\s*$/i);
        if (yearMatch) {
            if (yearMatch[1]) {
                withYearPrefix = true;
                year = yearMatch[2];
            } else {
                withYearPrefix = false;
                year = yearMatch[3];
            }
            fullTag = fullTag.substring(0, yearMatch.index).trim();
        }

        let weight = 1.0;
        let tag = fullTag;

        // V4 格式: 1.2::tag::
        const v4Match = fullTag.match(/^([\d.]+)::(.+)::$/);
        if (v4Match) {
            weight = parseFloat(v4Match[1]);
            tag = v4Match[2];
        } else {
            // 标准格式: (tag:1.2)
            const stdMatch = fullTag.match(/^\((.+):([\d.]+)\)$/);
            if (stdMatch) {
                tag = stdMatch[1];
                weight = parseFloat(stdMatch[2]);
            }
        }

        // Fallback: 年份在 tag 内部
        if (!year) {
            const innerYearMatch = tag.match(/, (?:(year\s+)(\S+)|(20\d{2}|19\d{2}))\s*$/i);
            if (innerYearMatch) {
                if (innerYearMatch[1]) {
                    withYearPrefix = true;
                    year = innerYearMatch[2];
                } else {
                    withYearPrefix = false;
                    year = innerYearMatch[3];
                }
                tag = tag.substring(0, innerYearMatch.index).trim();
            }
        }
        
        return {
            id: generateUUID(),
            tag,
            weight,
            year,
            withYearPrefix
        };
    });
}

export function serializeFixedArtists(items: FixedArtistItem[], useV4Format: boolean = false): string {
    return items.map(item => {
        let text = item.tag;
        if (item.year) {
            text += item.withYearPrefix ? `, year ${item.year}` : `, ${item.year}`;
        }
        if (item.weight !== 1.0 || useV4Format) {
            return `${item.weight}::${text}::`;
        }
        return text;
    }).join('\n');
}

interface ArtistState {
    // State
    artists: ArtistLite[];
    selectedArtists: Record<string, number>;
    searchQuery: string;
    sortMode: SortMode;
    isDataLoading: boolean;

    // Random Generator State (结构化数据)
    randomFixedArtists: FixedArtistItem[];
    randomPoolItems: FixedArtistItem[];
    randomPoolText: string;
    randomCountRange: { min: number; max: number };
    randomUsePrefix: boolean;
    randomOutputFormat: string;     // 'artist_tag' | 'name_only' | 'highres'
    randomGlobalWeight: number;     // 初始权重 0.5~5.0

    useV4Format: boolean;
    isOpen: boolean;
    isSidebarOpen: boolean;
    
    // Select Mode
    selectMode: boolean;
    onSelectCallback: ((artist: ArtistLite) => void) | null;
    
    // Combos / Presets
    combos: ArtistCombo[];
    previewIds: string[] | null;

    // Actions
    setSelectMode: (enabled: boolean, callback?: (artist: ArtistLite) => void) => void;
    loadArtists: () => Promise<void>;
    setIsOpen: (isOpen: boolean) => void;
    setIsSidebarOpen: (isOpen: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSortMode: (mode: SortMode) => void;
    toggleSelection: (id: string) => void;
    updateWeight: (id: string, weight: number) => void;
    clearSelection: () => void;
    setUseV4Format: (use: boolean) => void;

    // Random Generator Actions (结构化操作)
    setRandomFixedArtists: (items: FixedArtistItem[]) => void;
    addFixedArtist: (item: FixedArtistItem) => void;
    removeFixedArtist: (id: string) => void;
    updateFixedArtist: (id: string, updates: Partial<FixedArtistItem>) => void;
    moveFixedArtist: (id: string, direction: 'up' | 'down') => void;
    
    setRandomPoolItems: (items: FixedArtistItem[]) => void;
    addPoolItem: (item: FixedArtistItem) => void;
    removePoolItem: (id: string) => void;
    updatePoolItem: (id: string, updates: Partial<FixedArtistItem>) => void;
    movePoolItem: (id: string, direction: 'up' | 'down') => void;

    setRandomPoolText: (text: string) => void;
    setRandomCountRange: (range: { min: number; max: number }) => void;
    setRandomUsePrefix: (use: boolean) => void;
    setRandomOutputFormat: (format: string) => void;
    setRandomGlobalWeight: (weight: number) => void;
    
    // Combo Actions
    addCombo: (combo: ArtistCombo) => void;
    deleteCombo: (id: string) => void;
    setPreviewIds: (ids: string[] | null) => void;
    
    // DB Actions
    addArtist: (artist: Artist) => Promise<void>;
    deleteArtist: (id: string) => Promise<void>;
    updateArtistIsFavorite: (id: string, isFavorite: boolean) => Promise<void>;
    importArtists: (artists: Artist[]) => Promise<void>;
    
    // Computed
    getPrompt: () => string;
    /** 序列化固定画师列表为文本字符串（仅输出时调用） */
    getFixedArtistsString: () => string;
}

// removed to avoid duplication

export const useArtistStore = create<ArtistState>()(
    persist(
        (set, get) => ({
    artists: [],
    selectedArtists: {},
    searchQuery: '',
    sortMode: 'default',
    isDataLoading: false,
    isOpen: false,
    useV4Format: false,
    isSidebarOpen: true,
    
    randomFixedArtists: [],
    randomPoolItems: [],
    randomPoolText: '',
    randomCountRange: { min: 1, max: 2 },
    randomUsePrefix: false,
    randomOutputFormat: 'artist_tag',
    randomGlobalWeight: 1.0,

    previewIds: null,
    
    selectMode: false,
    onSelectCallback: null,

    setSelectMode: (enabled, callback) => set({ selectMode: enabled, onSelectCallback: callback || null }),

    setIsOpen: (isOpen) => set({ isOpen }),
    setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
    setUseV4Format: (use) => set({ useV4Format: use }),
    
    // --- 结构化固定画师操作 ---
    setRandomFixedArtists: (items) => set({ randomFixedArtists: items }),
    
    addFixedArtist: (item) => set(state => ({
        randomFixedArtists: [...state.randomFixedArtists, item]
    })),

    removeFixedArtist: (id) => set(state => ({
        randomFixedArtists: state.randomFixedArtists.filter(a => a.id !== id)
    })),

    updateFixedArtist: (id, updates) => set(state => ({
        randomFixedArtists: state.randomFixedArtists.map(a =>
            a.id === id ? { ...a, ...updates } : a
        )
    })),

    moveFixedArtist: (id, direction) => set(state => {
        const items = [...state.randomFixedArtists];
        const index = items.findIndex(a => a.id === id);
        if (index === -1) return state;
        if (direction === 'up' && index === 0) return state;
        if (direction === 'down' && index === items.length - 1) return state;
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        return { randomFixedArtists: items };
    }),

    setRandomPoolItems: (items) => set({ randomPoolItems: items }),
    
    addPoolItem: (item) => set(state => ({
        randomPoolItems: [...(state.randomPoolItems || []), item]
    })),

    removePoolItem: (id) => set(state => ({
        randomPoolItems: (state.randomPoolItems || []).filter(a => a.id !== id)
    })),

    updatePoolItem: (id, updates) => set(state => ({
        randomPoolItems: (state.randomPoolItems || []).map(a =>
            a.id === id ? { ...a, ...updates } : a
        )
    })),

    movePoolItem: (id, direction) => set(state => {
        const items = [...(state.randomPoolItems || [])];
        const index = items.findIndex(a => a.id === id);
        if (index === -1) return state;
        if (direction === 'up' && index === 0) return state;
        if (direction === 'down' && index === items.length - 1) return state;
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        return { randomPoolItems: items };
    }),

    setRandomPoolText: (text) => set({ randomPoolText: text }),
    setRandomCountRange: (range) => set({ randomCountRange: range }),
    setRandomUsePrefix: (use) => set({ randomUsePrefix: use }),
    setRandomOutputFormat: (format) => set({ randomOutputFormat: format }),
    setRandomGlobalWeight: (weight) => set({ randomGlobalWeight: weight }),
    
    setPreviewIds: (ids) => set({ previewIds: ids }),

    loadArtists: async () => {
        set({ isDataLoading: true });
        try {
            const artists = await artistDB.getAllArtistsLite();
            set({ artists });
        } catch (error) {
            console.error("Failed to load artists", error);
        } finally {
            set({ isDataLoading: false });
        }
    },

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortMode: (mode) => set({ sortMode: mode }),

    toggleSelection: (id) => set((state) => {
        const newSelected = { ...state.selectedArtists };
        if (newSelected[id]) {
            delete newSelected[id];
        } else {
            newSelected[id] = 1.0;
        }
        return { selectedArtists: newSelected };
    }),

    updateWeight: (id, weight) => set((state) => ({
        selectedArtists: {
            ...state.selectedArtists,
            [id]: weight
        }
    })),

    clearSelection: () => set({ selectedArtists: {} }),

    addArtist: async (artist) => {
        await artistDB.addArtist(artist);
        await get().loadArtists();
    },

    deleteArtist: async (id) => {
        await artistDB.deleteArtist(id);
        const newSelected = { ...get().selectedArtists };
        delete newSelected[id];
        set({ selectedArtists: newSelected });
        await get().loadArtists();
    },

    updateArtistIsFavorite: async (id, isFavorite) => {
        const artist = await artistDB.getArtist(id);
        if (artist) {
            artist.isFavorite = isFavorite;
            await artistDB.updateArtist(artist);
            set(state => ({
                artists: state.artists.map(a => a.id === id ? { ...a, isFavorite } : a)
            }));
        }
    },

    importArtists: async (newArtists) => {
        set({ isDataLoading: true });
        try {
            await artistDB.bulkAddArtists(newArtists);
            await get().loadArtists();
        } catch (error) {
            console.error("Import failed", error);
        } finally {
            set({ isDataLoading: false });
        }
    },

    getPrompt: () => {
        const { artists, selectedArtists, useV4Format } = get();
        const parts: string[] = [];
        
        Object.entries(selectedArtists).forEach(([id, weight]) => {
            const artist = artists.find(a => a.id === id);
            if (artist) {
                if (useV4Format) {
                    let tag = artist.tag;
                    if (!tag.startsWith('artist:')) {
                        tag = `artist:${tag}`;
                    }
                    // Fix: Add space if tag ends with digit to avoid parsing ambiguity with ::
                    if (/\d$/.test(tag)) {
                        tag += ' ';
                    }
                    parts.push(`${weight}::${tag}::`);
                } else {
                    if (weight === 1) {
                        parts.push(artist.tag);
                    } else {
                        parts.push(`(${artist.tag}:${weight})`);
                    }
                }
            }
        });
        
        return parts.join(', ');
    },

    /** 序列化固定画师为文本（通配符同步 & 生成输出用） */
    getFixedArtistsString: () => {
        const { randomFixedArtists, useV4Format } = get();
        return randomFixedArtists.map(a => {
            let tag = a.tag;
            // Fix: Add space if tag ends with digit before :: syntax
            if (/\d$/.test(tag)) {
                tag += ' ';
            }
            let weightedPart = `${a.weight}::${tag}::`;
            
            if (Math.abs(a.weight - 1.0) < 0.01 && !useV4Format) {
                weightedPart = a.tag; // Use original tag without space for non-weighted
            }
            if (a.year) {
                const prefix = a.withYearPrefix ? 'year ' : '';
                return `${weightedPart}, ${prefix}${a.year}`;
            }
            return weightedPart;
        }).join('\n');
    },

    // Combos
    combos: [],
    addCombo: (combo) => set(state => ({ combos: [...state.combos, combo] })),
    deleteCombo: (id) => set(state => ({ combos: state.combos.filter(c => c.id !== id) })),
}),
{
    name: 'artist-storage',
    version: 1,
    storage: createJSONStorage(() => indexedDBStorage),
    partialize: (state) => ({
        combos: state.combos,
        randomFixedArtists: state.randomFixedArtists,
        randomPoolText: state.randomPoolText,
        randomCountRange: state.randomCountRange,
        randomUsePrefix: state.randomUsePrefix,
        randomOutputFormat: state.randomOutputFormat,
        randomGlobalWeight: state.randomGlobalWeight,
        useV4Format: state.useV4Format,
        sortMode: state.sortMode,
        isSidebarOpen: state.isSidebarOpen
    }),
    // 迁移：旧版 randomFixedArtists 是 string，新版是 ArtistItem[]
    migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === undefined) {
            // v0 → v1: 字符串迁移为结构化数据
            if (typeof persistedState.randomFixedArtists === 'string') {
                persistedState.randomFixedArtists = parseFixedArtistsString(persistedState.randomFixedArtists);
            }
            // 补充新增字段默认值
            if (!persistedState.randomOutputFormat) {
                persistedState.randomOutputFormat = 'artist_tag';
            }
            if (!persistedState.randomGlobalWeight) {
                persistedState.randomGlobalWeight = 1.0;
            }
        }
        return persistedState;
    }
}
));
