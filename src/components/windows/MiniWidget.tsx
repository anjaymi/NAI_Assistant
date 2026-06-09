import { useState, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGenerationStore } from '@/stores/generation-store'
import { useAppStore } from '@/stores/app-store'
import { getCurrentWindow, LogicalSize, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from 'react-router-dom'
import { 
    Maximize2, 
    Wand2, 
    Image as ImageIcon,
    GripHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { shallow } from 'zustand/shallow'

const MINI_ROUTE_TRANSITION_MS = 240

/**
 * MiniWidget - Pro Max 级别悬浮窗组件
 * 
 * 特性:
 * - 全屏透明背景 + 自定义圆角
 * - 入场/退场动画
 * - 底部控制栏悬停显示
 * - 生成状态 spinner
 * - 拖拽移动窗口
 */
export function MiniWidget() {
    const navigate = useNavigate()
    const appWindow = getCurrentWindow()
    const [isHovered, setIsHovered] = useState(false)
    const [isReady, setIsReady] = useState(false)
    const [isExiting, setIsExiting] = useState(false)
    
    const { 
        previewImage: generatedImage, 
        isGenerating, 
        generate,
        prompt 
    } = useGenerationStore(
        (state) => ({
            previewImage: state.previewImage,
            isGenerating: state.isGenerating,
            generate: state.generate,
            prompt: state.prompt,
        }),
        shallow
    )
    
    const { 
        lastWindowSize, 
        lastWindowPos, 
        setLastWindowSize, 
        setLastWindowPos 
    } = useAppStore()

    // --- Window Logic ---
    useLayoutEffect(() => {
        const enterMiniMode = async () => {
            try {
                // 0. Enforce Transparent Background using CSS Class
                document.documentElement.classList.add('mini-window')
                
                // 1. Save current state before shrinking
                const size = await appWindow.innerSize()
                const pos = await appWindow.outerPosition()
                
                // Only save if reasonable (avoid saving small size if accidentally re-triggered)
                if (size.width > 500) {
                    setLastWindowSize({ width: size.width, height: size.height })
                    setLastWindowPos({ x: pos.x, y: pos.y })
                }

                // 2. Shrink and Remove Decorations
                await appWindow.setDecorations(false)
                await appWindow.setShadow(false) // Disable native shadow, use CSS shadow instead
                await appWindow.setAlwaysOnTop(true)
                await appWindow.setSize(new LogicalSize(300, 420)) // Slightly taller for better proportions
                
                // 3. Trigger entrance animation
                requestAnimationFrame(() => setIsReady(true))
            } catch (error) {
                console.error("Failed to enter Mini Mode:", error)
                setIsReady(true) // Still show content even if window ops fail
            }
        }

        enterMiniMode()
        
        return () => {
            // Restore background on unmount
            document.documentElement.classList.remove('mini-window')
        }
    }, [])

    const exitMiniMode = async () => {
        try {
            setIsExiting(true)
            setIsReady(false) // Trigger exit animation
            await new Promise(resolve => setTimeout(resolve, MINI_ROUTE_TRANSITION_MS)) // Wait for animation
            
            document.body.style.background = ''
            document.documentElement.style.background = ''
            // NOTE: Do NOT restore decorations, the app should always be frameless
            // await appWindow.setDecorations(true) -- REMOVED
            await appWindow.setShadow(true) // Restore window shadow
            await appWindow.setAlwaysOnTop(false)
            
            // Restore size or default
            const width = lastWindowSize.width > 0 ? lastWindowSize.width : 1200
            const height = lastWindowSize.height > 0 ? lastWindowSize.height : 800
            
            await appWindow.setSize(new PhysicalSize(width, height))
            if (lastWindowPos.x !== 0 || lastWindowPos.y !== 0) {
                 await appWindow.setPosition(new PhysicalPosition(lastWindowPos.x, lastWindowPos.y))
            }
            navigate('/')
        } catch (error) {
            console.error("Failed to exit Mini Mode:", error)
            navigate('/')
        }
    }

    // --- Drag Logic: Hybrid (JS pointer tracking + Rust SetWindowPos) ---
    const isDragging = useRef(false);
    const dragReady = useRef(false);
    const dragStartPointer = useRef({ x: 0, y: 0 });
    const dragStartWindowPos = useRef({ x: 0, y: 0 });
    const isFlushing = useRef(false);
    const latestTarget = useRef({ x: 0, y: 0 });

    const flushPosition = () => {
        if (isFlushing.current) return;
        const target = { ...latestTarget.current };
        isFlushing.current = true;
        invoke('move_window', { x: target.x, y: target.y })
            .catch(err => console.error('move_window failed:', err))
            .finally(() => {
                isFlushing.current = false;
                if (isDragging.current &&
                    (latestTarget.current.x !== target.x || latestTarget.current.y !== target.y)) {
                    flushPosition();
                }
            });
    };

    const handleDragPointerDown = async (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        const el = e.target as HTMLElement;
        el.setPointerCapture(e.pointerId);

        isDragging.current = true;
        dragReady.current = false;
        dragStartPointer.current = { x: e.screenX, y: e.screenY };

        try {
            const pos = await appWindow.outerPosition();
            dragStartWindowPos.current = { x: pos.x, y: pos.y };
            dragStartPointer.current = { x: e.screenX, y: e.screenY };
            dragReady.current = true;
        } catch (err) {
            console.error('Failed to get window state:', err);
            isDragging.current = false;
        }
    };

    const handleDragPointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !dragReady.current) return;
        e.preventDefault();
        latestTarget.current = {
            x: dragStartWindowPos.current.x + Math.round(e.screenX - dragStartPointer.current.x),
            y: dragStartWindowPos.current.y + Math.round(e.screenY - dragStartPointer.current.y)
        };
        flushPosition();
    };

    const handleDragPointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        dragReady.current = false;
        const el = e.target as HTMLElement;
        if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId);
    };

    return (
        <AnimatePresence mode="wait">
            {isReady && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.86, y: 18, filter: 'blur(16px)' }}
                    animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.92, y: 16, filter: 'blur(12px)' }}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                        "w-screen h-screen relative group bg-black/80 backdrop-blur-xl rounded-[1.7rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col touch-none overflow-hidden border border-white/10",
                        isExiting && "pointer-events-none"
                    )}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onPointerDown={handleDragPointerDown}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerUp}
                    onPointerCancel={handleDragPointerUp}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_rgba(255,255,255,0.04)_28%,_rgba(15,23,42,0.42)_70%,_rgba(2,6,23,0.8)_100%)]"
                    />

                    {/* Draggable Header Area */}
                    <div className="absolute top-0 left-0 right-0 h-16 z-30 flex justify-between items-center px-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                        {/* Drag Handle */}
                        <motion.div 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="pointer-events-auto p-2.5 text-white/50 hover:text-white/80 transition-colors hover:bg-white/10 rounded-xl cursor-grab active:cursor-grabbing" 
                        >
                            <GripHorizontal className="w-5 h-5" />
                        </motion.div>

                        {/* EXIT BUTTON */}
                        <motion.button 
                            whileHover={{ scale: 1.06, backgroundColor: "rgba(239, 68, 68, 0.88)" }}
                            whileTap={{ scale: 0.9 }}
                            className="pointer-events-auto h-8 w-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg transition-colors flex items-center justify-center text-white/70 hover:text-white"
                            onClick={exitMiniMode}
                            title="退出 Mini Mode"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <Maximize2 className="w-4 h-4" />
                        </motion.button>
                    </div>

                    {/* Background Image / Idle State */}
                    <div className="absolute inset-0 z-0 select-none pointer-events-none">
                        <AnimatePresence mode="wait">
                            {generatedImage ? (
                                <motion.img 
                                    key="generated"
                                    initial={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
                                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, scale: 1.02 }}
                                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                    src={generatedImage} 
                                    className="w-full h-full object-cover"
                                    alt="Generated"
                                />
                            ) : (
                                <motion.div 
                                    key="idle"
                                    initial={{ opacity: 0, scale: 1.02 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-full h-full flex flex-col items-center justify-center text-white/30 space-y-3 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800"
                                >
                                    <ImageIcon className="w-16 h-16 opacity-40" strokeWidth={1.5} />
                                    <span className="text-xs font-mono uppercase tracking-[0.3em] font-medium text-white/40">Idle</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* Generation Overlay */}
                        <AnimatePresence>
                            {isGenerating && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-10"
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="relative w-14 h-14">
                                            <motion.div 
                                                className="absolute inset-0 border-[4px] border-indigo-500/20 rounded-full" 
                                            />
                                            <motion.div 
                                                className="absolute inset-0 border-t-[4px] border-indigo-400 rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-white/80 tracking-[0.15em] uppercase">生成中</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bottom Controls - Slide up on hover */}
                    <motion.div 
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ 
                            y: isHovered || isGenerating || !generatedImage ? 0 : 60,
                            opacity: isHovered || isGenerating || !generatedImage ? 1 : 0
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
                    >
                        <div className="space-y-2.5">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.04, duration: 0.24 }}
                                className="flex items-center justify-between px-1"
                            >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                                    Mini Mode
                                </div>
                                <div className="text-[10px] text-white/35">
                                    {generatedImage ? 'Preview Live' : 'Ready'}
                                </div>
                            </motion.div>

                            {/* Prompt Snippet */}
                            {prompt && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[10px] text-white/60 line-clamp-2 px-3 py-2 font-mono leading-relaxed bg-white/5 rounded-lg border border-white/10"
                                >
                                    {prompt}
                                </motion.div>
                            )}
                            
                            {/* Generate Button */}
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                    "w-full h-11 rounded-xl font-semibold tracking-wide transition-all flex items-center justify-center gap-2 text-sm",
                                    isGenerating 
                                        ? "bg-indigo-600/50 text-indigo-200 cursor-not-allowed"
                                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                                )}
                                onClick={() => !isGenerating && generate()}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <span className="flex items-center gap-2">
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-4 h-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full"
                                        />
                                        处理中...
                                    </span>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4" />
                                        重新生成
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
