import React, { useEffect, useMemo, useRef, useId, forwardRef } from 'react';
import './GlassSurface.css';
import { cn } from '@/lib/utils';

let svgGlassSupportCache: boolean | null = null;

function detectSvgGlassSupport() {
    if (svgGlassSupportCache !== null) {
        return svgGlassSupportCache;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        svgGlassSupportCache = false;
        return svgGlassSupportCache;
    }

    const userAgent = navigator.userAgent;
    const isTauriRuntime = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    const isWebkit = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const cpuCores = navigator.hardwareConcurrency ?? 8;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const isLowPowerDevice = deviceMemory <= 4 || (cpuCores <= 4 && window.innerWidth < 1600);

    svgGlassSupportCache = !(isTauriRuntime || isWebkit || isFirefox || isAndroid || prefersReducedMotion || isLowPowerDevice);
    return svgGlassSupportCache;
}

export interface GlassSurfaceProps {
    children?: React.ReactNode;
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    borderWidth?: number;
    brightness?: number;
    opacity?: number;
    blur?: number;
    displace?: number;
    backgroundOpacity?: number;
    saturation?: number;
    distortionScale?: number;
    redOffset?: number;
    greenOffset?: number;
    blueOffset?: number;
    xChannel?: 'R' | 'G' | 'B';
    yChannel?: 'R' | 'G' | 'B';
    mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity'
    | 'plus-darker'
    | 'plus-lighter';
    className?: string;
    style?: React.CSSProperties;
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(({
    children,
    width,     // Allow auto width
    height,    // Allow auto height
    borderRadius = 12, // Adjusted default to match app theme
    borderWidth = 0.5,
    brightness = 70,    // Optimized for dark mode
    opacity = 0.5,
    blur = 8,
    displace = 0.5,
    backgroundOpacity = 0.1,
    saturation = 1,
    distortionScale = 20, // Reduced for subtlety
    redOffset = 1,
    greenOffset = 2,
    blueOffset = 3,
    xChannel = 'R',
    yChannel = 'G',
    mixBlendMode = 'overlay',
    className = '',
    style = {}
}, ref) => {
    const id = useId();
    const filterId = `glass-filter-${id.replace(/:/g, '')}`; // Sanitize ID
    const redGradId = `red-grad-${id.replace(/:/g, '')}`;
    const blueGradId = `blue-grad-${id.replace(/:/g, '')}`;
    const svgFiltersEnabled = useMemo(() => detectSvgGlassSupport(), []);

    const containerRef = useRef<HTMLDivElement>(null);
    // Merge refs
    useEffect(() => {
        if (typeof ref === 'function') ref(containerRef.current);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = containerRef.current;
    }, [ref]);

    const feImageRef = useRef<SVGFEImageElement>(null);
    const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
    const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

    const generateDisplacementMap = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        const actualWidth = rect?.width || 100;
        const actualHeight = rect?.height || 100;
        const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.1);

        const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

        return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    };

    const updateDisplacementMap = () => {
        if (!svgFiltersEnabled) return;
        if (feImageRef.current) {
            feImageRef.current.setAttribute('href', generateDisplacementMap());
        }
    };

    useEffect(() => {
        if (!svgFiltersEnabled) return;

        updateDisplacementMap();
        [
            { ref: redChannelRef, offset: redOffset },
            { ref: greenChannelRef, offset: greenOffset },
            { ref: blueChannelRef, offset: blueOffset }
        ].forEach(({ ref, offset }) => {
            if (ref.current) {
                ref.current.setAttribute('scale', (distortionScale + offset).toString());
                ref.current.setAttribute('xChannelSelector', xChannel);
                ref.current.setAttribute('yChannelSelector', yChannel);
            }
        });

        gaussianBlurRef.current?.setAttribute('stdDeviation', displace.toString());
    }, [
        width,
        height,
        borderRadius,
        borderWidth,
        brightness,
        opacity,
        blur,
        displace,
        distortionScale,
        redOffset,
        greenOffset,
        blueOffset,
        xChannel,
        yChannel,
        mixBlendMode,
        svgFiltersEnabled
    ]);

    useEffect(() => {
        if (!svgFiltersEnabled || !containerRef.current) return;

        let frameId: number | null = null;
        const scheduleUpdate = () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            frameId = requestAnimationFrame(() => {
                frameId = null;
                updateDisplacementMap();
            });
        };

        const resizeObserver = new ResizeObserver(scheduleUpdate);

        resizeObserver.observe(containerRef.current);
        scheduleUpdate();

        return () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            resizeObserver.disconnect();
        };
    }, [svgFiltersEnabled, width, height, borderRadius, borderWidth, brightness, opacity, blur, displace, distortionScale, redOffset, greenOffset, blueOffset, xChannel, yChannel, mixBlendMode]);

    const containerStyle: React.CSSProperties = {
        ...style,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        borderRadius: `${borderRadius}px`,
        '--glass-frost': backgroundOpacity,
        '--glass-saturation': saturation,
        '--filter-id': `url(#${filterId})`
    } as React.CSSProperties;

    return (
        <div
            ref={containerRef}
            className={cn(`glass-surface ${svgFiltersEnabled ? 'glass-surface--svg' : 'glass-surface--fallback'}`, className)}
            style={containerStyle}
        >
            {svgFiltersEnabled && (
                <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
                            <feImage ref={feImageRef} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />

                            <feDisplacementMap ref={redChannelRef} in="SourceGraphic" in2="map" id="redchannel" result="dispRed" />
                            <feColorMatrix
                                in="dispRed"
                                type="matrix"
                                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                                result="red"
                            />

                            <feDisplacementMap
                                ref={greenChannelRef}
                                in="SourceGraphic"
                                in2="map"
                                id="greenchannel"
                                result="dispGreen"
                            />
                            <feColorMatrix
                                in="dispGreen"
                                type="matrix"
                                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                                result="green"
                            />

                            <feDisplacementMap ref={blueChannelRef} in="SourceGraphic" in2="map" id="bluechannel" result="dispBlue" />
                            <feColorMatrix
                                in="dispBlue"
                                type="matrix"
                                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                                result="blue"
                            />

                            <feBlend in="red" in2="green" mode="screen" result="rg" />
                            <feBlend in="rg" in2="blue" mode="screen" result="output" />
                            <feGaussianBlur ref={gaussianBlurRef} in="output" stdDeviation="0.7" />
                        </filter>
                    </defs>
                </svg>
            )}

            <div className="glass-surface__content">{children}</div>
        </div>
    );
});

GlassSurface.displayName = 'GlassSurface';
