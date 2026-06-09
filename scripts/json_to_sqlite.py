import json
import sqlite3
import base64
import os
import sys

# Configuration
SOURCE_JSON_PATH = r"G:\nai4\reference_source new\画师管理小工具V2\画师管理小工具V2\画师数据JSON\11.20整理.json"
OUTPUT_DB_PATH = r"../src-tauri/resources/data.db"

def ensure_dir(file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)

def convert_json_to_sqlite():
    print(f"Reading JSON from: {SOURCE_JSON_PATH}")
    
    if not os.path.exists(SOURCE_JSON_PATH):
        print(f"Error: Source file not found at {SOURCE_JSON_PATH}")
        return

    try:
        with open(SOURCE_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    artists = data.get('artists', [])
    print(f"Found {len(artists)} artists. Creating database...")

    ensure_dir(OUTPUT_DB_PATH)
    
    # Connect to SQLite
    if os.path.exists(OUTPUT_DB_PATH):
        os.remove(OUTPUT_DB_PATH) # Start fresh
        
    conn = sqlite3.connect(OUTPUT_DB_PATH)
    cursor = conn.cursor()

    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            tag TEXT,
            count INTEGER DEFAULT 0,
            last_modified TEXT,
            preview_image BLOB,
            is_favorite INTEGER DEFAULT 0,
            description TEXT
        )
    ''')

    # Prepare data
    count = 0
    skipped_images = 0
    
    for artist in artists:
        a_id = artist.get('id')
        name = artist.get('name')
        img_count = artist.get('count', 0)
        time = artist.get('time')
        b64_image = artist.get('image', '')

        # Decode image
        image_blob = None
        if b64_image:
            try:
                # Remove header if present (e.g. "data:image/jpeg;base64,")
                if ',' in b64_image:
                    b64_image = b64_image.split(',', 1)[1]
                image_blob = base64.b64decode(b64_image)
            except Exception:
                skipped_images += 1
                print(f"Warning: Failed to decode image for artist {name}")

        # Generate tag from name: replace spaces with underscores, add artist: prefix
        tag = f"artist:{name.replace(' ', '_')}" if name else None
        
        cursor.execute('''
            INSERT INTO artists (id, name, tag, count, last_modified, preview_image)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (a_id, name, tag, img_count, time, image_blob))
        
        count += 1
        if count % 1000 == 0:
            print(f"Processed {count} artists...")

    print("Committing changes...")
    conn.commit()
    
    print("Running VACUUM to optimize size...")
    cursor.execute("VACUUM")
    conn.commit()
    
    conn.close()
    
    # Stats
    db_size = os.path.getsize(OUTPUT_DB_PATH) / (1024 * 1024)
    print(f"Success! Database created at {OUTPUT_DB_PATH}")
    print(f"Total Artists: {count}")
    print(f"Skipped Images: {skipped_images}")
    print(f"Database Size: {db_size:.2f} MB")

if __name__ == "__main__":
    convert_json_to_sqlite()
