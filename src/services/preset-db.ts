import Database from '@tauri-apps/plugin-sql';
import { Preset } from '../stores/preset-store';

const DB_PATH = "sqlite:data.db";

export class PresetDB {
    private db: Database | null = null;

    private async init() {
        if (!this.db) {
            // Guard against web environments where Tauri APIs don't exist
            if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
                console.warn("[PresetDB] Running in web mode. Local SQL db is disabled.");
                return null;
            }
            try {
                this.db = await Database.load(DB_PATH);
                await this.ensureSchema();
            } catch (error) {
                console.error("[PresetDB] Init error:", error);
            }
        }
        return this.db;
    }

    private async getDB(): Promise<Database | null> {
        if (!this.db) await this.init();
        if (!this.db) {
            console.warn("[PresetDB] Database not available");
            return null;
        }
        return this.db;
    }

    private async ensureSchema() {
        const db = await this.getDB();
        if (!db) return;
        
        const tableExists = await db.select<any[]>("SELECT name FROM sqlite_master WHERE type='table' AND name='presets'");
        if (tableExists.length === 0) {
            await db.execute(`
                CREATE TABLE presets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at INTEGER,
                    updated_at INTEGER,
                    is_default INTEGER DEFAULT 0
                )
            `);
        }
    }

    async addPreset(preset: Preset): Promise<void> {
        const db = await this.getDB();
        if (!db) return;
        const { id, name, createdAt, isDefault, ...data } = preset;
        const now = Date.now();
        
        await db.execute(
            `INSERT INTO presets (id, name, data, created_at, updated_at, is_default)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                data = excluded.data,
                updated_at = excluded.updated_at,
                is_default = excluded.is_default
            `,
            [id, name, JSON.stringify(data), createdAt, now, isDefault ? 1 : 0]
        );
    }

    async deletePreset(id: string): Promise<void> {
        const db = await this.getDB();
        if (!db) return;
        await db.execute("DELETE FROM presets WHERE id = $1", [id]);
    }

    async getAllPresets(): Promise<Preset[]> {
        const db = await this.getDB();
        if (!db) return [];
        const rows = await db.select<any[]>("SELECT * FROM presets");
        
        return rows.map(row => {
            const data = JSON.parse(row.data);
            return {
                id: row.id,
                name: row.name,
                createdAt: row.created_at,
                isDefault: Boolean(row.is_default),
                ...data
            };
        });
    }

    async getPreset(id: string): Promise<Preset | undefined> {
        const db = await this.getDB();
        if (!db) return undefined;
        const rows = await db.select<any[]>("SELECT * FROM presets WHERE id = $1", [id]);
        if (rows.length > 0) {
            const row = rows[0];
            const data = JSON.parse(row.data);
            return {
                id: row.id,
                name: row.name,
                createdAt: row.created_at,
                isDefault: Boolean(row.is_default),
                ...data
            };
        }
        return undefined;
    }
}

export const presetDB = new PresetDB();
