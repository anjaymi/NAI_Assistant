import type { NAIMetadata } from './metadata-parser'
import type { MetadataParams } from './metadata-writer'

function uint32ToUint8LE(num: number): Uint8Array {
    return new Uint8Array([
        num & 0xff,
        (num >>> 8) & 0xff,
        (num >>> 16) & 0xff,
        (num >>> 24) & 0xff,
    ])
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
}

function stringToUint8(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

export function buildNAIMetadata(params: MetadataParams): NAIMetadata {
    const metadata: NAIMetadata = {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        steps: params.steps,
        width: params.width,
        height: params.height,
        cfgScale: params.cfgScale,
        cfgRescale: params.cfgRescale,
        seed: params.seed,
        model: params.model,
        sampler: params.sampler,
        scheduler: params.scheduler,
        smea: params.smea,
        smeaDyn: params.smeaDyn,
        qualityToggle: true,
        ucPreset: params.ucPreset,
    }

    if (params.characterPrompts.length > 0) {
        metadata.v4_prompt = {
            caption: {
                base_caption: params.prompt,
                char_captions: params.characterPrompts.map((c) => ({
                    char_caption: c.prompt,
                    centers: [{ x: 0.5, y: 0.5 }],
                })),
            },
        }

        metadata.v4_negative_prompt = {
            caption: {
                base_caption: params.negativePrompt,
                char_captions: params.characterPrompts.map((c) => ({
                    char_caption: c.negative || '',
                    centers: [{ x: 0.5, y: 0.5 }],
                })),
            },
        }
    }

    return metadata
}

export function injectWebPMetadata(imageBytes: Uint8Array, metadata: NAIMetadata): Uint8Array {
    const riff = String.fromCharCode(...imageBytes.slice(0, 4))
    const webp = String.fromCharCode(...imageBytes.slice(8, 12))
    if (riff !== 'RIFF' || webp !== 'WEBP') {
        return imageBytes
    }

    const metadataBytes = stringToUint8(JSON.stringify(metadata))
    const chunkType = stringToUint8('NAIS')
    const chunkSize = metadataBytes.length
    const padding = chunkSize % 2 === 1 ? 1 : 0
    const chunk = new Uint8Array(8 + chunkSize + padding)
    chunk.set(chunkType, 0)
    chunk.set(uint32ToUint8LE(chunkSize), 4)
    chunk.set(metadataBytes, 8)

    const result = new Uint8Array(imageBytes.length + chunk.length)
    result.set(imageBytes, 0)
    result.set(chunk, imageBytes.length)

    const riffSize = result.length - 8
    result.set(uint32ToUint8LE(riffSize), 4)

    return result
}

export function extractWebPMetadata(bytes: Uint8Array): NAIMetadata | null {
    const riff = String.fromCharCode(...bytes.slice(0, 4))
    const webp = String.fromCharCode(...bytes.slice(8, 12))
    if (riff !== 'RIFF' || webp !== 'WEBP') {
        return null
    }

    let offset = 12
    while (offset + 8 <= bytes.length) {
        const chunkType = String.fromCharCode(...bytes.slice(offset, offset + 4))
        const chunkSize = readUint32LE(bytes, offset + 4)
        const dataStart = offset + 8
        const dataEnd = dataStart + chunkSize

        if (chunkType === 'NAIS' && dataEnd <= bytes.length) {
            try {
                const text = new TextDecoder('utf-8').decode(bytes.slice(dataStart, dataEnd))
                const parsed = JSON.parse(text) as NAIMetadata
                return { ...parsed, source: 'webp_chunk' }
            } catch (error) {
                console.error('Failed to parse WebP metadata chunk:', error)
                return null
            }
        }

        offset = dataEnd + (chunkSize % 2)
    }

    return null
}
