import { useState, useRef, useEffect, KeyboardEvent, useCallback, ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { getCaretCoordinates } from '@/utils/caret-coords'
import { cn } from '@/lib/utils'
import { useFragmentStore } from '@/stores/fragment-store'

const tagShardModules = import.meta.glob('@/assets/tags-shards/*.json')
const FALLBACK_BUCKET = 'misc'

// --- Types ---
interface Tag {
    label: string
    value: string
    count: number
    type: string
    translation?: string
}

interface SuggestionItem {
    label: string
    value: string
    count?: number
    type: string
    translation?: string
    _lower?: string
    _translation_lower?: string
}

type TagShardManifest = Record<string, number>

interface AutocompleteTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void // Standard React Event
    className?: string
    maxSuggestions?: number
    padding?: number | string
}

// --- Constants ---
const TAG_TYPES = ['general', 'copyright', 'character', 'artist'] as const
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

let manifestPromise: Promise<TagShardManifest> | null = null
const shardCache = new Map<string, SuggestionItem[]>()

function preprocessTags(tags: Tag[]): SuggestionItem[] {
    return tags.map(tag => ({
        ...tag,
        _lower: tag.label.toLowerCase(),
        _translation_lower: tag.translation?.toLowerCase()
    }))
}

async function loadTagManifest() {
    if (!manifestPromise) {
        const loader = tagShardModules['/src/assets/tags-shards/manifest.json']
        if (!loader) {
            throw new Error('Tag shard manifest is missing')
        }

        manifestPromise = loader().then((module) => (module as { default: TagShardManifest }).default)
    }

    return manifestPromise
}

function buildShardPrefix(value: string) {
    const lower = value.toLowerCase()
    const match = lower.match(/[a-z]/)
    const primary = match ? match[0] : FALLBACK_BUCKET
    const alnum = lower.replace(/[^a-z0-9]/g, '')
    return {
        primary,
        secondary: alnum[1] || '_',
        tertiary: alnum[2] || '_',
        quaternary: alnum[3] || '_'
    }
}

async function loadTagShard(shardKey: string) {
    if (shardCache.has(shardKey)) {
        return shardCache.get(shardKey)!
    }

    const loader = tagShardModules[`/src/assets/tags-shards/${shardKey}.json`]
    if (!loader) {
        shardCache.set(shardKey, [])
        return []
    }

    const module = await loader()
    const processed = preprocessTags((module as { default: Tag[] }).default)
    shardCache.set(shardKey, processed)
    return processed
}

async function loadCandidateTags(query: string) {
    const manifest = await loadTagManifest()
    const { primary, secondary, tertiary, quaternary } = buildShardPrefix(query)

    const exactShardKeys = TAG_TYPES
        .map((type) => {
            const hotKey = `${type}:${primary}`
            if (type === 'general' && primary === 'a' && secondary === 'r') {
                if (tertiary === 't') {
                    return `${type}-${primary}-${secondary}-${tertiary}-${quaternary}`
                }
                return `${type}-${primary}-${secondary}-${tertiary}`
            }
            if (HOT_BUCKETS.has(hotKey)) {
                return `${type}-${primary}-${secondary}`
            }
            return `${type}-${primary}`
        })
        .filter((key) => manifest[key])

    const shardGroups = await Promise.all(exactShardKeys.map((key) => loadTagShard(key)))
    return shardGroups.flat()
}

function appendUniqueMatches(target: SuggestionItem[], source: SuggestionItem[], limit: number, predicate: (tag: SuggestionItem) => boolean) {
    const seen = new Set(target.map((item) => item.value))

    for (const tag of source) {
        if (target.length >= limit) break
        if (seen.has(tag.value)) continue
        if (!predicate(tag)) continue
        target.push(tag)
        seen.add(tag.value)
    }
}

export function AutocompleteTextarea({
    value,
    onChange,
    className,
    maxSuggestions = 15,
    style,
    padding, // Ignored in native textarea as it's part of className/style usually, but we accept it to match props
    ...props
}: AutocompleteTextareaProps) {
    // --- Refs ---
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const isComposing = useRef(false)
    const autocompleteRequestId = useRef(0)
    const autocompleteTimeoutId = useRef<number | null>(null)

    // Fragment Store subscription
    const fragmentFiles = useFragmentStore(state => state.files)

    // --- State ---
    const [localValue, setLocalValue] = useState(value)
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const [suggestionMode, setSuggestionMode] = useState<'tag' | 'wildcard'>('tag')
    const [isTagDataReady, setIsTagDataReady] = useState(false)

    // Sync from parent if value changes explicitly outside (e.g., cleared or loaded from history)
    useEffect(() => {
        setLocalValue(value)
    }, [value])

    // --- Helpers ---
    const getCurrentWord = (text: string, position: number) => {
        const left = text.slice(0, position)
        // Match backwards to comma, newline, or :: (for V4 weight syntax like 2::tag::)
        const match = left.match(/[^,\n:]*$/)
        return match ? match[0].trimStart() : ''
    }

    const getWildcardWord = (text: string, position: number): string | null => {
        const left = text.slice(0, position)
        const match = left.match(/<([^<>]*)$/)
        return match ? match[1] : null
    }

    // --- Autocomplete Logic ---
    const checkAutocomplete = useCallback(async (val: string, el: HTMLTextAreaElement) => {
        const requestId = ++autocompleteRequestId.current
        const pos = el.selectionEnd || val.length

        // 1. Check Fragment Mode (`<` prefix)
        const wildcardWord = getWildcardWord(val, pos)
        if (wildcardWord !== null) {
            const lower = wildcardWord.toLowerCase()
            const matches: SuggestionItem[] = []

            for (const file of fragmentFiles) {
                if (matches.length >= maxSuggestions) break
                const fullPath = file.folder ? `${file.folder}/${file.name}` : file.name
                const fullPathLower = fullPath.toLowerCase()

                if (wildcardWord === '' || fullPathLower.includes(lower)) {
                    matches.push({
                        label: fullPath,
                        value: fullPath,
                        count: file.lineCount,
                        type: 'fragment'
                    })
                }
            }

            if (matches.length > 0) {
                if (requestId !== autocompleteRequestId.current) return
                setSuggestions(matches)
                setSuggestionMode('wildcard')
                setSelectedIndex(0)

                const rect = el.getBoundingClientRect()
                const caret = getCaretCoordinates(el, pos)
                
                // Adjust for scrollTop since we overlay on body
                setCoords({
                    top: rect.top + window.scrollY + caret.top + 24, // 24px line height approx buffer
                    left: rect.left + window.scrollX + caret.left
                })
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
            return
        }

        // 2. Normal Tag Autocomplete
        const word = getCurrentWord(val, pos)
        if (word.length < 1) {
            setIsVisible(false)
            return
        }

        const lower = word.toLowerCase()
        const isAscii = /^[\x00-\x7F]*$/.test(word)
        const matches: SuggestionItem[] = []
        const tagsWithLower = await loadCandidateTags(lower)
        if (requestId !== autocompleteRequestId.current) return
        setIsTagDataReady(true)

        if (isAscii) {
            appendUniqueMatches(matches, tagsWithLower, maxSuggestions, (tag) => tag._lower?.startsWith(lower) === true)
            if (matches.length < maxSuggestions) {
                appendUniqueMatches(matches, tagsWithLower, maxSuggestions, (tag) => {
                    if (tag._lower?.startsWith(lower)) return false
                    return tag._lower?.includes(lower) === true || tag._translation_lower?.includes(lower) === true
                })
            }
        } else {
            const exactTranslationMatches = tagsWithLower.filter((tag) => tag._translation_lower?.startsWith(lower))
            appendUniqueMatches(matches, exactTranslationMatches, maxSuggestions, () => true)

            if (matches.length < maxSuggestions) {
                appendUniqueMatches(matches, tagsWithLower, maxSuggestions, (tag) => tag._translation_lower?.includes(lower) === true)
            }
        }

        if (matches.length > 0) {
            if (requestId !== autocompleteRequestId.current) return
            setSuggestions(matches)
            setSuggestionMode('tag')
            setSelectedIndex(0)

            const rect = el.getBoundingClientRect()
            const caret = getCaretCoordinates(el, pos)

            setCoords({
                top: rect.top + window.scrollY + caret.top + 24,
                left: rect.left + window.scrollX + caret.left
            })
            setIsVisible(true)
        } else {
            setIsVisible(false)
        }
    }, [maxSuggestions, fragmentFiles])

    const scheduleAutocomplete = useCallback((val: string, el: HTMLTextAreaElement) => {
        if (autocompleteTimeoutId.current !== null) {
            window.clearTimeout(autocompleteTimeoutId.current)
        }

        const delay = val.length > 24 ? 90 : 40
        autocompleteTimeoutId.current = window.setTimeout(() => {
            autocompleteTimeoutId.current = null
            void checkAutocomplete(val, el)
        }, delay)
    }, [checkAutocomplete])

    const insertSuggestion = (suggestion: SuggestionItem) => {
        if (!textareaRef.current) return
        const el = textareaRef.current
        const val = value
        const pos = el.selectionEnd || 0

        if (suggestionMode === 'wildcard') {
            const left = val.slice(0, pos)
            const bracketPos = left.lastIndexOf('<')
            if (bracketPos === -1) return

            const before = val.slice(0, bracketPos)
            const after = val.slice(pos)
            const newValue = before + '<' + suggestion.value + '>' + after
            const newCursorPos = bracketPos + suggestion.value.length + 2

            // Native set value compatible with React
            triggerReactChange(el, newValue)
            
            setIsVisible(false)
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
                    textareaRef.current.focus()
                }
            })
        } else {
            const left = val.slice(0, pos)
            const wordMatch = left.match(/[^,\n:]*$/)
            if (!wordMatch) return

            const wordStart = wordMatch.index!
            const before = val.slice(0, wordStart)
            const after = val.slice(pos)

            const lastChar = before.slice(-1)
            const needsSpace = before.length > 0 && ![' ', '\n', ':'].includes(lastChar)
            const prefix = needsSpace ? ' ' : ''
            const suffix = ', '

            const newValue = before + prefix + suggestion.value + suffix + after
            const newCursorPos = wordStart + prefix.length + suggestion.value.length + suffix.length

            triggerReactChange(el, newValue)

            setIsVisible(false)
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
                    textareaRef.current.focus()
                }
            })
        }
    }
    
    // Helper to simulate React Change Event for uncontrolled inputs logic
    const triggerReactChange = (target: HTMLTextAreaElement, newValue: string) => {
        setLocalValue(newValue) // Update local immediately to prevent visual flicker
        
        // Create a lightweight synthetic event
        // We avoid spreading `...target` because DOM elements don't spread well
        const event = {
            target: {
                ...target, // This might not work as intended for DOM props, but we mainly need value
                value: newValue,
                name: target.name,
                id: target.id,
                type: target.type,
            },
            currentTarget: target,
            preventDefault: () => {},
            stopPropagation: () => {},
            nativeEvent: {} as Event,
            isDefaultPrevented: () => false,
            isPropagationStopped: () => false,
            persist: () => {},
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            eventPhase: 0,
            isTrusted: true,
            timeStamp: Date.now(),
        } as unknown as ChangeEvent<HTMLTextAreaElement>
        
        onChange(event)
    }

    // --- Event Handlers ---
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (isVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % suggestions.length)
                return
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
                return
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                e.stopPropagation()
                if (suggestions[selectedIndex]) {
                    insertSuggestion(suggestions[selectedIndex])
                }
                return
            } else if (e.key === 'Escape') {
                setIsVisible(false)
                return
            }
        }
        props.onKeyDown?.(e)
    }

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value
        setLocalValue(newVal) // Always let native input succeed locally
        
        // IME 组合过程中不触发外部 onChange，防止标点双写和其他突变
        if (isComposing.current) return
        
        onChange(e)
        scheduleAutocomplete(newVal, e.target)
    }
    
    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
        scheduleAutocomplete(value, e.currentTarget)
        props.onClick?.(e)
    }

    // --- Effects ---
    useEffect(() => {
        if (value.trim().length < 2) return
        loadCandidateTags(value.trim()).then(() => setIsTagDataReady(true)).catch(() => {})
    }, [value])

    useEffect(() => {
        return () => {
            autocompleteRequestId.current += 1
            if (autocompleteTimeoutId.current !== null) {
                window.clearTimeout(autocompleteTimeoutId.current)
            }
        }
    }, [])

    // Close on outside events
    useEffect(() => {
        const handleWindowEvents = (e: Event) => {
            if (isVisible && listRef.current && !listRef.current.contains(e.target as Node)) {
                setIsVisible(false)
            }
        }
        if (isVisible) {
            window.addEventListener('scroll', handleWindowEvents, true)
            window.addEventListener('resize', handleWindowEvents)
            window.addEventListener('click', handleWindowEvents)
        }
        return () => {
            window.removeEventListener('scroll', handleWindowEvents, true)
            window.removeEventListener('resize', handleWindowEvents)
            window.removeEventListener('click', handleWindowEvents)
        }
    }, [isVisible])
    
    // Auto-scroll list
    useEffect(() => {
        if (!isVisible || !listRef.current) return
        const list = listRef.current
        const item = list.children[0]?.children[selectedIndex] as HTMLElement
        if (item) {
            const itemTop = item.offsetTop
            const itemBottom = itemTop + item.offsetHeight
            const listTop = list.scrollTop
            const listBottom = listTop + list.clientHeight
            if (itemTop < listTop) list.scrollTop = itemTop
            else if (itemBottom > listBottom) list.scrollTop = itemBottom - list.clientHeight
        }
    }, [selectedIndex, isVisible])

    return (
        <>
            <textarea
                ref={(node) => {
                    textareaRef.current = node
                    // Forward ref if needed? But we are managing ref internally.
                    // If parent passed ref, we should handle it (omitted for brevity as we don't use it in PromptArea)
                }}
                style={style}
                className={className}
                {...props}
                value={localValue}
                onChange={handleChange}
                onCompositionStart={() => { isComposing.current = true }}
                onCompositionEnd={(e) => {
                    isComposing.current = false
                    // IME 提交后触发一次 onChange 和 autocomplete
                    const target = e.target as HTMLTextAreaElement
                    const syntheticEvent = {
                        ...e,
                        target,
                        currentTarget: target,
                    } as unknown as ChangeEvent<HTMLTextAreaElement>
                    onChange(syntheticEvent)
                    scheduleAutocomplete(target.value, target)
                }}
                onKeyDown={handleKeyDown}
                onClick={handleClick}
                onKeyUp={(e) => scheduleAutocomplete(localValue, e.currentTarget)}
            />

            {isVisible && suggestions.length > 0 && createPortal(
                <div
                    ref={listRef}
                    className="fixed z-[9999] w-64 bg-popover/95 backdrop-blur-md text-popover-foreground rounded-lg border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}
                >
                    <div className="p-1">
                        {suggestions.map((item, index) => (
                            <div
                                key={item.value + index}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer select-none transition-colors",
                                    index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                                onMouseDown={(e) => {
                                    // CRITICAL: Prevent default to stop blur event on textarea
                                    e.preventDefault()
                                    e.stopPropagation()
                                    insertSuggestion(item)
                                }}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="truncate font-semibold text-sm">
                                            {item.type === 'fragment' ? `<${item.label}>` : item.label}
                                        </span>
                                        {item.translation && (
                                            <span className="truncate text-[10px] text-muted-foreground/70 font-normal">
                                                {item.translation}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] opacity-80">
                                        <span className={cn(
                                            "uppercase tracking-wider font-bold",
                                            item.type === 'fragment' ? "text-green-300" :
                                                item.type === 'artist' ? "text-yellow-300" :
                                                    item.type === 'character' ? "text-green-300" :
                                                        item.type === 'copyright' ? "text-fuchsia-300" :
                                                            "text-blue-300"
                                        )}>
                                            {item.type}
                                        </span>
                                        <span>
                                            {item.type === 'fragment'
                                                ? `${item.count} lines`
                                                : (item.count ?? 0) >= 1000 ? ((item.count ?? 0) / 1000).toFixed(1) + 'k' : item.count}
                                        </span>
                                        {!isTagDataReady && suggestionMode === 'tag' && (
                                            <span className="text-muted-foreground/70">loading...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
