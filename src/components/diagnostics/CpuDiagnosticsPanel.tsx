import { useEffect, useMemo, useRef, useState } from 'react'
import { useGenerationStore } from '@/stores/generation-store'

type StoreCounters = {
    total: number
    previewImage: number
    sourceImage: number
    mask: number
    progress: number
    isGenerating: number
}

type Metrics = {
    fps: number
    maxFrameGapMs: number
    maxEventLoopLagMs: number
    domNodes: number
    images: number
    canvases: number
    videos: number
    animatedElements: number
    transitionElements: number
    filterElements: number
    backdropFilterElements: number
    visibleImages: number
    dataUrlImages: number
    blobUrlImages: number
    store: StoreCounters
    effectsDisabled: boolean
    imagesHidden: boolean
    galleryHidden: boolean
}

const emptyStoreCounters: StoreCounters = {
    total: 0,
    previewImage: 0,
    sourceImage: 0,
    mask: 0,
    progress: 0,
    isGenerating: 0,
}

function isEnabled() {
    if (!import.meta.env.DEV) return false
    if (typeof window === 'undefined') return false
    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return true
    const params = new URLSearchParams(window.location.search)
    return params.get('cpu') === '1' || window.localStorage.getItem('NAI_CPU_DIAG') === '1'
}

function createInitialMetrics(): Metrics {
    return {
        fps: 0,
        maxFrameGapMs: 0,
        maxEventLoopLagMs: 0,
        domNodes: 0,
        images: 0,
        canvases: 0,
        videos: 0,
        animatedElements: 0,
        transitionElements: 0,
        filterElements: 0,
        backdropFilterElements: 0,
        visibleImages: 0,
        dataUrlImages: 0,
        blobUrlImages: 0,
        store: { ...emptyStoreCounters },
        effectsDisabled: false,
        imagesHidden: false,
        galleryHidden: false,
    }
}

function countRuntimeElements(storeCounters: StoreCounters, fps: number, maxFrameGapMs: number, maxEventLoopLagMs: number): Metrics {
    const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'))
    const images = Array.from(document.images)
    let animatedElements = 0
    let transitionElements = 0
    let filterElements = 0
    let backdropFilterElements = 0
    let visibleImages = 0
    let dataUrlImages = 0
    let blobUrlImages = 0

    for (const element of allElements) {
        const style = window.getComputedStyle(element)
        if (style.animationName !== 'none' && style.animationDuration !== '0s') animatedElements++
        if (style.transitionProperty !== 'none' && style.transitionDuration !== '0s') transitionElements++
        if (style.filter !== 'none') filterElements++
        if (style.backdropFilter !== 'none') backdropFilterElements++
    }

    for (const image of images) {
        const rect = image.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) visibleImages++
        if (image.currentSrc.startsWith('data:') || image.src.startsWith('data:')) dataUrlImages++
        if (image.currentSrc.startsWith('blob:') || image.src.startsWith('blob:')) blobUrlImages++
    }

    return {
        fps,
        maxFrameGapMs: Math.round(maxFrameGapMs),
        maxEventLoopLagMs: Math.round(maxEventLoopLagMs),
        domNodes: allElements.length,
        images: images.length,
        canvases: document.querySelectorAll('canvas').length,
        videos: document.querySelectorAll('video').length,
        animatedElements,
        transitionElements,
        filterElements,
        backdropFilterElements,
        visibleImages,
        dataUrlImages,
        blobUrlImages,
        store: { ...storeCounters },
        effectsDisabled: document.documentElement.dataset.naiCpuLite === 'true',
        imagesHidden: document.documentElement.dataset.naiHideImages === 'true',
        galleryHidden: document.documentElement.dataset.naiHideGallery === 'true',
    }
}

export function CpuDiagnosticsPanel() {
    const enabled = useMemo(() => isEnabled(), [])
    const [metrics, setMetrics] = useState<Metrics>(() => createInitialMetrics())
    const [isSampling, setIsSampling] = useState(false)
    const countersRef = useRef<StoreCounters>({ ...emptyStoreCounters })

    useEffect(() => {
        if (!enabled) return

        const unsubscribe = useGenerationStore.subscribe((state, prev) => {
            const counters = countersRef.current
            counters.total++
            if (state.previewImage !== prev.previewImage) counters.previewImage++
            if (state.sourceImage !== prev.sourceImage) counters.sourceImage++
            if (state.mask !== prev.mask) counters.mask++
            if (state.generationProgress !== prev.generationProgress) counters.progress++
            if (state.isGenerating !== prev.isGenerating) counters.isGenerating++
        })

        setMetrics(countRuntimeElements(countersRef.current, 0, 0, 0))

        return () => {
            unsubscribe()
        }
    }, [enabled])

    if (!enabled) return null

    const sampleOneSecond = () => {
        if (isSampling) return
        setIsSampling(true)

        let frameCount = 0
        let maxFrameGapMs = 0
        let lastFrameAt = performance.now()
        let maxEventLoopLagMs = 0
        let expectedTick = performance.now() + 250
        let rafId = 0

        const tickFrame = (now: number) => {
            frameCount++
            maxFrameGapMs = Math.max(maxFrameGapMs, now - lastFrameAt)
            lastFrameAt = now
            rafId = requestAnimationFrame(tickFrame)
        }

        rafId = requestAnimationFrame(tickFrame)

        const lagTimer = window.setInterval(() => {
            const now = performance.now()
            maxEventLoopLagMs = Math.max(maxEventLoopLagMs, now - expectedTick)
            expectedTick = now + 250
        }, 250)

        window.setTimeout(() => {
            cancelAnimationFrame(rafId)
            window.clearInterval(lagTimer)
            setMetrics(countRuntimeElements(countersRef.current, frameCount, maxFrameGapMs, maxEventLoopLagMs))
            countersRef.current = { ...emptyStoreCounters }
            setIsSampling(false)
        }, 1000)
    }

    const setEffectsDisabled = (disabled: boolean) => {
        if (disabled) {
            document.documentElement.dataset.naiCpuLite = 'true'
        } else {
            delete document.documentElement.dataset.naiCpuLite
        }
        setMetrics(countRuntimeElements(metrics.store, metrics.fps, metrics.maxFrameGapMs, metrics.maxEventLoopLagMs))
    }

    const setImagesHidden = (hidden: boolean) => {
        if (hidden) {
            document.documentElement.dataset.naiHideImages = 'true'
        } else {
            delete document.documentElement.dataset.naiHideImages
        }
        setMetrics(countRuntimeElements(metrics.store, metrics.fps, metrics.maxFrameGapMs, metrics.maxEventLoopLagMs))
    }

    const setGalleryHidden = (hidden: boolean) => {
        if (hidden) {
            document.documentElement.dataset.naiHideGallery = 'true'
        } else {
            delete document.documentElement.dataset.naiHideGallery
        }
        setMetrics(countRuntimeElements(metrics.store, metrics.fps, metrics.maxFrameGapMs, metrics.maxEventLoopLagMs))
    }

    const mark = () => {
        console.table(metrics)
    }

    return (
        <div className="fixed right-3 top-3 z-[99999] w-[360px] rounded-2xl border border-white/10 bg-black/85 p-3 text-xs text-white shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold text-white/90">CPU Diagnostics</div>
                <div className="text-[10px] text-white/45">dev only</div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-white/50">fps</span><span>{metrics.fps}</span>
                <span className="text-white/50">max frame gap</span><span>{metrics.maxFrameGapMs}ms</span>
                <span className="text-white/50">event lag</span><span>{metrics.maxEventLoopLagMs}ms</span>
                <span className="text-white/50">dom nodes</span><span>{metrics.domNodes}</span>
                <span className="text-white/50">img/canvas/video</span><span>{metrics.images}/{metrics.canvases}/{metrics.videos}</span>
                <span className="text-white/50">visible imgs</span><span>{metrics.visibleImages}</span>
                <span className="text-white/50">data/blob imgs</span><span>{metrics.dataUrlImages}/{metrics.blobUrlImages}</span>
                <span className="text-white/50">animations</span><span>{metrics.animatedElements}</span>
                <span className="text-white/50">transitions</span><span>{metrics.transitionElements}</span>
                <span className="text-white/50">filter</span><span>{metrics.filterElements}</span>
                <span className="text-white/50">backdrop</span><span>{metrics.backdropFilterElements}</span>
                <span className="text-white/50">store total</span><span>{metrics.store.total}</span>
                <span className="text-white/50">preview/source/mask</span><span>{metrics.store.previewImage}/{metrics.store.sourceImage}/{metrics.store.mask}</span>
                <span className="text-white/50">progress/gen</span><span>{metrics.store.progress}/{metrics.store.isGenerating}</span>
            </div>

            <div className="mt-3 flex gap-2">
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={sampleOneSecond}>
                    {isSampling ? 'Sampling...' : 'Sample 1s'}
                </button>
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setEffectsDisabled(!metrics.effectsDisabled)}>
                    {metrics.effectsDisabled ? 'Enable Effects' : 'Disable Effects'}
                </button>
            </div>

            <div className="mt-2 flex gap-2">
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setImagesHidden(!metrics.imagesHidden)}>
                    {metrics.imagesHidden ? 'Show Images' : 'Hide Images'}
                </button>
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setGalleryHidden(!metrics.galleryHidden)}>
                    {metrics.galleryHidden ? 'Show Gallery' : 'Hide Gallery'}
                </button>
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={mark}>Mark</button>
                <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => localStorage.setItem('NAI_CPU_DIAG', '1')}>Persist</button>
            </div>
        </div>
    )
}
