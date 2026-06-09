/**
 * Metadata Writer for NAI Images
 * Injects NAI-compatible metadata into PNG files via tEXt chunks.
 */

export interface MetadataParams {
    prompt: string
    negativePrompt: string
    steps: number
    width: number
    height: number
    cfgScale: number
    cfgRescale: number
    seed: number
    model: string
    sampler: string
    scheduler: string
    smea: boolean
    smeaDyn: boolean
    ucPreset: number
    characterPrompts: Array<{
        prompt: string
        negative?: string
        enabled: boolean
    }>
    characterPositionEnabled: boolean
}

// CRC Table lookup
const CRC_TABLE: number[] = []
for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
        if (c & 1) {
            c = 0xedb88320 ^ (c >>> 1)
        } else {
            c = c >>> 1
        }
    }
    CRC_TABLE[n] = c
}

function updateCRC(crc: number, buf: Uint8Array): number {
    let c = crc
    for (let n = 0; n < buf.length; n++) {
        c = CRC_TABLE[(c ^ buf[n]) & 0xff] ^ (c >>> 8)
    }
    return c
}

function crc(buf: Uint8Array): number {
    return updateCRC(0xffffffff, buf) ^ 0xffffffff
}

function stringToUint8(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

function uint32ToUint8(num: number): Uint8Array {
    return new Uint8Array([
        (num >>> 24) & 0xff,
        (num >>> 16) & 0xff,
        (num >>> 8) & 0xff,
        num & 0xff
    ])
}

/**
 * Creates a PNG tEXt chunk
 */
function createTextChunk(keyword: string, text: string): Uint8Array {
    const keyData = stringToUint8(keyword)
    const textData = stringToUint8(text)
    const length = keyData.length + 1 + textData.length
    
    // Chunk Type: tEXt
    const type = stringToUint8('tEXt')
    
    // Data: Keyword + null + Text
    const data = new Uint8Array(length)
    data.set(keyData, 0)
    data[keyData.length] = 0 // null separator
    data.set(textData, keyData.length + 1)
    
    // Calculate CRC over Type + Data
    const crcInput = new Uint8Array(type.length + data.length)
    crcInput.set(type, 0)
    crcInput.set(data, type.length)
    const crcValue = crc(crcInput)
    
    // Assemble full chunk: Length + Type + Data + CRC
    const chunk = new Uint8Array(4 + 4 + length + 4)
    chunk.set(uint32ToUint8(length), 0)
    chunk.set(type, 4)
    chunk.set(data, 8)
    chunk.set(uint32ToUint8(crcValue), 8 + length)
    
    return chunk
}

/**
 * Inject NAI Metadata into PNG binary data
 */
export function injectNAIMetadata(imageBytes: Uint8Array, params: MetadataParams): Uint8Array {
    // 1. Construct Metadata JSON
    const metadata = {
        prompt: params.prompt,
        steps: params.steps,
        height: params.height,
        width: params.width,
        scale: params.cfgScale,
        uncond_scale: 1.0, // Default for NAI
        cfg_rescale: params.cfgRescale,
        seed: params.seed, // Ensure strictly the seed used
        n_samples: 1,
        hide_debug_overlay: false,
        noise_schedule: params.scheduler,
        legacy_v3_extend: false,
        reference_information_extracted_multiple: [],
        reference_strength_multiple: [],
        sampler: params.sampler,
        controlnet_strength: 1.0,
        n_iter: 1,
        uc: params.negativePrompt,
        ucPreset: params.ucPreset,
        qualityToggle: true,
        sm: params.smea,
        sm_dyn: params.smeaDyn,
        dynamic_thresholding: false,
        controlnet_model: null,
        add_original_image: true,
        sh: 0, // session hash placeholder
        
        // V4 Specifics
        ...(params.model.includes('pdf') || (params.characterPrompts && params.characterPrompts.length > 0) ? {
             v4_prompt: {
                caption: {
                    base_caption: params.prompt,
                    char_captions: params.characterPrompts.map((c: any) => ({
                        char_caption: c.prompt,
                        centers: [{ x: 0.5, y: 0.5 }] // Simplified
                    }))
                },
                use_coords: params.characterPositionEnabled,
                use_order: true
             },
             v4_negative_prompt: {
                caption: {
                    base_caption: params.negativePrompt,
                    char_captions: params.characterPrompts.map((c: any) => ({
                        char_caption: c.negative || '',
                        centers: [{ x: 0.5, y: 0.5 }]
                    }))
                }
             }
        } : {})
    }

    // 2. Create Chunks
    // Main Comment chunk
    const commentChunk = createTextChunk('Comment', JSON.stringify(metadata))
    
    // Source chunk ("NovelAI")
    // NAI usually puts "Title": "AI generated image" and "Software": "NovelAI" and "Source": "NovelAI Diffusion V..."
    const softwareChunk = createTextChunk('Software', 'NovelAI')
    const titleChunk = createTextChunk('Title', 'AI generated image')
    const sourceChunk = createTextChunk('Source', 'NovelAI') // Simplified, real NAI puts full model name

    // 3. Insert chunks before IEND (or after IHDR)
    // NAI usually inserts after IHDR. Let's insert after IHDR (byte 33 usually).
    // PNG Header: 8 bytes
    // IHDR Chunk: 13 bytes data + 12 overhead = 25 bytes.
    // So IHDR ends at index 8 + 25 = 33.
    
    // Safe check for IHDR
    const ihdrLen = (imageBytes[8] << 24) | (imageBytes[9] << 16) | (imageBytes[10] << 8) | imageBytes[11]
    const ihdrEnd = 8 + 12 + ihdrLen // 8 (sig) + 4(len) + 4(type) + len + 4(crc)
    
    // New buffer size
    const newSize = imageBytes.length + commentChunk.length + softwareChunk.length + titleChunk.length + sourceChunk.length
    const finalBytes = new Uint8Array(newSize)
    
    // Copy Header + IHDR
    finalBytes.set(imageBytes.slice(0, ihdrEnd), 0)
    
    let currentOffset = ihdrEnd
    
    // Insert Metadata Chunks
    finalBytes.set(titleChunk, currentOffset); currentOffset += titleChunk.length
    finalBytes.set(softwareChunk, currentOffset); currentOffset += softwareChunk.length
    finalBytes.set(sourceChunk, currentOffset); currentOffset += sourceChunk.length
    finalBytes.set(commentChunk, currentOffset); currentOffset += commentChunk.length
    
    // Copy rest of file
    finalBytes.set(imageBytes.slice(ihdrEnd), currentOffset)
    
    return finalBytes
}
