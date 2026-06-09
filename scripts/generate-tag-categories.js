
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../public/plugins/magic-tag/tagClassify.csv');
const outPath = path.resolve(__dirname, '../src/assets/tag_categories.json');

const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split(/\r?\n/).filter(l => l.trim());

// Header: "en","cn","type"
const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

const categories = {};

for (let i = 1; i < lines.length; i++) {
    // Basic CSV parsing handling quotes
    const line = lines[i];
    const parts = [];
    let current = '';
    let inQuote = false;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current);

    if (parts.length < 3) continue;

    const en = parts[0];
    const cn = parts[1];
    const type = parts[2];

    if (!categories[type]) {
        categories[type] = [];
    }

    categories[type].push({
        label: en,
        value: en,
        cn: cn
    });
}

fs.writeFileSync(outPath, JSON.stringify(categories, null, 2));
console.log(`Generated tag categories at ${outPath}`);
