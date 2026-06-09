const fs = require('fs')
const path = require('path')

const INPUT_PATH = path.join(__dirname, '../src/assets/tags.json')
const OUTPUT_DIR = path.join(__dirname, '../src/assets/tags-shards')
const FALLBACK_BUCKET = 'misc'

function normalizeBaseLabel(tag) {
  if (tag.type === 'artist') {
    return String(tag.label || '').replace(/^artist:/i, '').trim().toLowerCase()
  }

  return String(tag.label || '').trim().toLowerCase()
}

const HOT_BUCKETS = new Set([
  'artist:a',
  'artist:c',
  'artist:h',
  'artist:k',
  'artist:m',
  'artist:n',
  'artist:p',
  'artist:r',
  'artist:s',
  'artist:t',
  'artist:y',
  'character:a',
  'character:k',
  'character:m',
  'character:s',
  'general:a',
  'general:b',
  'general:c',
  'general:h',
  'general:k',
  'general:m',
  'general:p',
  'general:s',
  'general:t',
])

function buildBucket(type, value) {
  const match = value.match(/[a-z]/)
  const primary = match ? match[0] : FALLBACK_BUCKET
  const hotKey = `${type}:${primary}`

  if (!HOT_BUCKETS.has(hotKey)) {
    return primary
  }

  const alnum = value.replace(/[^a-z0-9]/g, '')
  const secondary = alnum[1] || '_'

  if (type === 'general' && primary === 'a' && secondary === 'r') {
    const tertiary = alnum[2] || '_'
    if (tertiary === 't') {
      const quaternary = alnum[3] || '_'
      return `${primary}-${secondary}-${tertiary}-${quaternary}`
    }
    return `${primary}-${secondary}-${tertiary}`
  }

  if (type === 'character' && primary === 'k') {
    const tertiary = alnum[1] || '_'
    return `${primary}-${tertiary}`
  }

  return `${primary}-${secondary}`
}

function main() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf8')
  const tags = JSON.parse(raw)
  const shards = new Map()

  for (const tag of tags) {
    const normalized = normalizeBaseLabel(tag)
    const bucket = buildBucket(tag.type, normalized)
    const shardKey = `${tag.type}-${bucket}`

    if (!shards.has(shardKey)) {
      shards.set(shardKey, [])
    }

    shards.get(shardKey).push(tag)
  }

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifest = {}
  for (const [shardKey, records] of shards.entries()) {
    records.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return String(a.label).localeCompare(String(b.label))
    })

    const fileName = `${shardKey}.json`
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(records))
    manifest[shardKey] = records.length
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`Wrote ${Object.keys(manifest).length} shards to ${OUTPUT_DIR}`)
}

main()
