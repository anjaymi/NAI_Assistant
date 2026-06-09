import { useWildcardStore } from '@/stores/wildcard-store'

/**
 * Fragment Processor (Wildcard Handler)
 * Supported Formats:
 * 1. Parenthesis: (option1/option2) or (opt1, opt2/opt3)
 * 2. Simple: red/blue/green (no spaces)
 * 3. File-based: <filename> or __filename__
 * 4. Inline: <opt1|opt2>
 * 5. Sequential: <*filename> (Fragment only for now)
 */

// Placeholder for store access. We will implement the store next.
let fragmentStore: any = null

export const setFragmentStore = (store: any) => {
    fragmentStore = store
}

async function processFileWildcards(prompt: string): Promise<string> {
    // Matches <name> or __name__
    // Group 1: <content>
    // Group 2: __content__
    // Updated to support Unicode/Spaces in __wildcard__ (lazy match)
    const filePattern = /<([^<>]+)>|__(.+?)__/g
    const matches: { match: string; content: string; index: number }[] = []

    let match
    while ((match = filePattern.exec(prompt)) !== null) {
        matches.push({
            match: match[0],
            content: match[1] || match[2],
            index: match.index
        })
    }

    if (matches.length === 0) return prompt

    const replacements = await Promise.all(
        matches.map(async ({ match, content }) => {
            const trimmed = content.trim()

            // 1. Inline: <opt1|opt2> (Only for <>)
            if (match.startsWith('<') && trimmed.includes('|')) {
                const options = trimmed.split('|').map(o => o.trim()).filter(Boolean)
                if (options.length > 0) {
                    return { match, replacement: options[Math.floor(Math.random() * options.length)] }
                }
                return { match, replacement: match }
            }

            // 2. Wildcard Store (Local Files) priority for __syntax__ or if file exists
            const wildcardStore = useWildcardStore.getState()
            let fileName = trimmed
            if (!fileName.toLowerCase().endsWith('.txt')) fileName += '.txt'

            // Check if file exists in wildcard store
            // Case-insensitive check
            const wildcardFile = wildcardStore.files.find(f => f.name.toLowerCase() === fileName.toLowerCase())
            
            if (wildcardFile) {
                try {
                    // Force refresh if content is missing (though synchronous access might fail if not loaded)
                    let content = wildcardFile.content
                    if (content === undefined) {
                        content = await wildcardStore.readFile(wildcardFile.id)
                    }

                    const lines = (content || "").split('\n')
                        .map(l => l.trim())
                        .filter(l => l && !l.startsWith('#'))
                    
                    if (lines.length > 0) {
                        // Special Logic for <固定画师> (Fixed Artist) -> Use ALL lines
                        if (fileName.toLowerCase().includes('固定画师')) {
                             console.log('[Wildcard] Expanding Fixed Artists:', lines.length)
                             const joined = lines.join(', ')
                             // Recursive check on the result? Usually artists are plain text
                             return { match, replacement: joined }
                        }

                        // Special Logic for <随机画师> (Random Artist) -> Pick ONE (already default, but explicit)
                        // OR Default behavior for any other wildcard -> Pick ONE
                        const randomLine = lines[Math.floor(Math.random() * lines.length)]
                        
                        // Recursive check
                        if (randomLine.includes('<') || randomLine.includes('__')) {
                             return { match, replacement: await processFileWildcards(randomLine) }
                        }
                        return { match, replacement: randomLine }
                    }
                } catch (e) {
                    console.error('Failed to process wildcard:', fileName, e)
                    // If failed, return match so user sees the tag failed
                }
            } else {
                console.warn('[Wildcard] File not found:', fileName, 'Available:', wildcardStore.files.map(f => f.name))
            }

            // 3. Sequential/File (Fragment Store Fallback)
            if (fragmentStore && match.startsWith('<')) {
                const isSequential = trimmed.startsWith('*')
                const rawPath = isSequential ? trimmed.slice(1) : trimmed
                const path = rawPath.toLowerCase().replace(/\\/g, '/') 

                const line = isSequential
                    ? await fragmentStore.getSequentialLine(path)
                    : await fragmentStore.getRandomLine(path)

                if (line !== null) {
                     return { match, replacement: await processFileWildcards(line) }
                }
            }

            return { match, replacement: match }
        })
    )

    let result = prompt
    for (let i = replacements.length - 1; i >= 0; i--) {
        const { match, replacement } = replacements[i]
        const idx = result.lastIndexOf(match)
        if (idx !== -1) {
            result = result.slice(0, idx) + replacement + result.slice(idx + match.length)
        }
    }

    return result
}

function processParenthesisWildcards(prompt: string): string {
    // Matches (a/b) but handles commas inside options: (a, b/c, d)
    const parenPattern = /\(([^()]+\/[^()]+)\)/g
    return prompt.replace(parenPattern, (_, content) => {
        const options = content.split('/').map((o: string) => o.trim()).filter(Boolean)
        return options.length > 0 
            ? options[Math.floor(Math.random() * options.length)] 
            : content
    })
}

function processSimpleWildcards(prompt: string): string {
    return prompt.split(',').map(tag => {
        const trimmed = tag.trim()
        // Simple wildcard: no spaces, has slash, not a URL
        if (trimmed.includes('/') && !trimmed.includes(' ') && !trimmed.includes('://')) {
            const options = trimmed.split('/').map(o => o.trim()).filter(Boolean)
            if (options.length > 1) {
                return options[Math.floor(Math.random() * options.length)]
            }
        }
        return trimmed
    }).join(', ')
}

export async function processWildcards(prompt: string): Promise<string> {
    if (!prompt) return prompt
    let result = prompt
    // Recursive loop limit to prevent infinite
    let passes = 0
    while ((result.includes('<') || result.includes('__')) && passes < 5) {
        const newResult = await processFileWildcards(result)
        if (newResult === result) break
        result = newResult
        passes++
    }
    
    result = processParenthesisWildcards(result)
    result = processSimpleWildcards(result)
    return result
}
