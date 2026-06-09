import Database from '@tauri-apps/plugin-sql';

const DB_PATH = "sqlite:data.db";

export interface WildcardItem {
    id: string;
    name: string;
    content: string;
    collection: string; // Folder path or "" for root
    createdAt: number;
    updatedAt: number;
    deleted: boolean;
}

export class WildcardDB {
    private db: Database | null = null;

    private async init() {
        if (!this.db) {
            if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
                console.warn('[WildcardDB] Running in web mode. Local SQL db is disabled.');
                return null;
            }
            this.db = await Database.load(DB_PATH);
            await this.ensureSchema();
        }
        return this.db;
    }

    private async getDB(): Promise<Database> {
        if (!this.db) await this.init();
        if (!this.db) throw new Error("Database failed to initialize");
        return this.db;
    }

    private async ensureSchema() {
        if (!this.db) return;
        
        const tableExists = await this.db.select<any[]>("SELECT name FROM sqlite_master WHERE type='table' AND name='wildcards'");
        if (tableExists.length === 0) {
            await this.db.execute(`
                CREATE TABLE wildcards (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    content TEXT,
                    collection TEXT,
                    created_at INTEGER,
                    updated_at INTEGER,
                    deleted INTEGER DEFAULT 0
                )
            `);
        }
    }

    async addOrUpdateWildcard(item: WildcardItem): Promise<void> {
        const db = await this.getDB();
        const { id, name, content, collection, createdAt, updatedAt, deleted } = item;
        
        await db.execute(
            `INSERT INTO wildcards (id, name, content, collection, created_at, updated_at, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                content = excluded.content,
                collection = excluded.collection,
                updated_at = excluded.updated_at,
                deleted = excluded.deleted
            `,
            [id, name, content, collection || "", createdAt, updatedAt, deleted ? 1 : 0]
        );
    }

    async getWildcard(id: string): Promise<WildcardItem | undefined> {
        const db = await this.getDB();
        const rows = await db.select<any[]>("SELECT * FROM wildcards WHERE id = $1", [id]);
        if (rows.length > 0) {
            return this.mapRow(rows[0]);
        }
        return undefined;
    }

    async getAllWildcards(): Promise<WildcardItem[]> {
        const db = await this.getDB();
        const rows = await db.select<any[]>("SELECT * FROM wildcards WHERE deleted = 0");
        return rows.map(this.mapRow);
    }
    
    // For Sync: Get including deleted, modified after timestamp
    async getChanges(lastSync: number): Promise<WildcardItem[]> {
        const db = await this.getDB();
        const rows = await db.select<any[]>("SELECT * FROM wildcards WHERE updated_at > $1", [lastSync]);
        return rows.map(this.mapRow);
    }
    
    // For checking existence by name/collection during import
    async findByName(name: string, collection: string): Promise<WildcardItem | undefined> {
        const db = await this.getDB();
        // collection can be null in DB if I wasn't careful, so coerce
        const rows = await db.select<any[]>(
            "SELECT * FROM wildcards WHERE name = $1 AND collection = $2 AND deleted = 0", 
            [name, collection || ""]
        );
        if (rows.length > 0) return this.mapRow(rows[0]);
        return undefined;
    }

    private mapRow(row: any): WildcardItem {
        return {
            id: row.id,
            name: row.name,
            content: row.content,
            collection: row.collection || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deleted: Boolean(row.deleted)
        };
    }
}

export const wildcardDB = new WildcardDB();
