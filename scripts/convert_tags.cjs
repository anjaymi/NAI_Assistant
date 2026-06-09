const fs = require('fs');
const path = require('path');

const CSV_PATH = String.raw`G:\nai4\reference_source\Semi-Auto-NovelAI-to-Pixiv-3.16.0\files\webui\danbooru_e621_merged_with_zh.csv`;
const OUTPUT_PATH = path.join(__dirname, '../src/assets/tags.json');

// Tag types mapping (heuristics or if available in csv)
// For now, default everything to 'general' unless we find type info.
// Common Danbooru types: 0: general, 1: artist, 3: copyright, 4: character, 5: meta
// This specific CSV doesn't seem to have type column based on "head" output.

function parseCSV(content) {
    const lines = content.split(/\r?\n/);
    const tags = [];
    
    console.log(`Processing ${lines.length} lines...`);
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        // CSV parsing (naive but likely sufficient for tags)
        const parts = line.split(',');
        if (parts.length < 2) continue;
        
        const label = parts[0].trim();
        const count = parseInt(parts[1], 10) || 0;
        const translation = parts[2] ? parts[2].trim() : '';
        
        // Heuristics for type coloring (optional)
        let type = 'general';
        if (count > 5000000 && label === '1girl') type = 'general'; 
        
        tags.push({
            label,
            value: label,
            count,
            type,
            translation // Add translation for search
        });
    }
    
    // Sort by count desc
    tags.sort((a, b) => b.count - a.count);
    
    return tags;
}

try {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const tags = parseCSV(content);
    
    // Validate encoding by checking "1girl" translation
    const girlTag = tags.find(t => t.label === '1girl');
    console.log('Sample tag:', girlTag);
    
    // Determine if we need to filter deeply to save size?
    // 6M lines is too big for JSON import in browser. 
    // Typical reliable tagset is top 50k-100k.
    const TOP_N = 100000;
    const limitedTags = tags.slice(0, TOP_N);
    
    console.log(`Saving top ${TOP_N} tags to ${OUTPUT_PATH}`);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(limitedTags, null, 2)); // minimized? null, 2 for readable check first
    console.log('Done!');
    
} catch (e) {
    console.error('Error:', e);
}
