import React, { lazy } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGenerationStore } from '@/stores/generation-store';
import { GlassSurface } from '@/components/atoms/GlassSurface';
import { MobileSyncButton } from './MobileSyncButton';
import { shallow } from 'zustand/shallow';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const ImagePreview = lazy(() => import('@/components/organisms/ImagePreview').then((module) => ({ default: module.ImagePreview })));

export function MobilePreviewCard() {
    const {
        isGenerating,
        previewImage,
        width,
        height,
        generationProgress,
        prompt,
        negativePrompt,
        seed,
        model,
        steps,
        cfgScale,
        sampler,
    } = useGenerationStore(
        (state) => ({
            isGenerating: state.isGenerating,
            previewImage: state.previewImage,
            width: state.width,
            height: state.height,
            generationProgress: state.generationProgress,
            prompt: state.prompt,
            negativePrompt: state.negativePrompt,
            seed: state.seed,
            model: state.model,
            steps: state.steps,
            cfgScale: state.cfgScale,
            sampler: state.sampler,
        }),
        shallow
    );

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative group perspective-1000 w-full"
        >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-500/20 to-blue-500/20 rounded-[24px] blur-xl opacity-50 transition duration-1000"></div>
            
            <GlassSurface 
                className="relative aspect-[3/4] w-full rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/10"
                borderRadius={24}
                brightness={80}
                backgroundOpacity={0.05}
            >
                <LazyModuleBoundary className="h-full min-h-0" label="Loading preview canvas...">
                    <ImagePreview
                        imageSrc={previewImage}
                        isGenerating={isGenerating}
                        progress={generationProgress}
                        className="w-full h-full object-contain"
                        originalWidth={width}
                        originalHeight={height}
                        hideControls={true}
                    />
                </LazyModuleBoundary>
                
                {/* LAN Sync Button — 仅在有图片且未生成中时出现 */}
                {previewImage && !isGenerating && (
                    <div className="absolute bottom-3 right-3 z-10">
                        <MobileSyncButton
                            imageSrc={previewImage}
                            filename={`nai_${Date.now()}.png`}
                            metadata={{
                                prompt: prompt || '',
                                negativePrompt: negativePrompt || '',
                                seed: seed ?? 0,
                                model: model || '',
                                steps: steps || 0,
                                cfgScale: cfgScale || 0,
                                sampler: sampler || '',
                                width: width || 0,
                                height: height || 0,
                            }}
                        />
                    </div>
                )}
            </GlassSurface>
        </motion.div>
    );
}
