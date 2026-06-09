const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuration
const SOURCE_JSON_PATH = "G:\\nai4\\reference_source new\\画师管理小工具V2\\画师管理小工具V2\\画师数据JSON\\11.20整理.json";
const OUTPUT_DB_DIR = path.join(__dirname, '../src-tauri/resources');
const OUTPUT_DB_PATH = path.join(OUTPUT_DB_DIR, 'data.db');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DB_DIR)){
    fs.mkdirSync(OUTPUT_DB_DIR, { recursive: true });
}

// Remove existing DB to start fresh
if (fs.existsSync(OUTPUT_DB_PATH)) {
    fs.unlinkSync(OUTPUT_DB_PATH);
}

console.log(`Reading JSON from: ${SOURCE_JSON_PATH}`);

try {
    const rawData = fs.readFileSync(SOURCE_JSON_PATH, 'utf8');
    const data = JSON.parse(rawData);
    const artists = data.artists || [];

    console.log(`Found ${artists.length} artists. Creating database at ${OUTPUT_DB_PATH}...`);

    const db = new sqlite3.Database(OUTPUT_DB_PATH);

    db.serialize(() => {
        // Create table
        db.run(`
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                last_modified TEXT,
                preview_image BLOB
            )
        `);

        const stmt = db.prepare(`
            INSERT INTO artists (id, name, count, last_modified, preview_image)
            VALUES (?, ?, ?, ?, ?)
        `);

        let count = 0;
        let skippedImages = 0;

        db.parallelize(() => {
            artists.forEach(artist => {
                let imageBlob = null;
                if (artist.image) {
                    try {
                        // Remove header if present
                        let b64 = artist.image;
                        if (b64.includes(',')) {
                            b64 = b64.split(',')[1];
                        }
                        imageBlob = Buffer.from(b64, 'base64');
                    } catch (e) {
                        skippedImages++;
                        console.error(`Failed to decode image for ${artist.name}`);
                    }
                }

                stmt.run(artist.id, artist.name, artist.count || 0, artist.time, imageBlob);
                
                count++;
                if (count % 1000 === 0) {
                    console.log(`Processed ${count} records...`);
                }
            });
        });

        stmt.finalize();

        // Optimize
        console.log("Running VACUUM...");
        db.run("VACUUM", () => {
            console.log("Database creation and optimization complete.");
            console.log(`Total Artists: ${count}`);
            console.log(`Skipped Images: ${skippedImages}`);
            
            const stats = fs.statSync(OUTPUT_DB_PATH);
            console.log(`Database Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            db.close();
        });
    });

} catch (err) {
    console.error("Error:", err);
}
