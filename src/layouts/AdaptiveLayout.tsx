import React, { lazy } from 'react';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useAppStore } from '@/stores/app-store';
import { LazyModuleBoundary } from '@/components/templates/LazyModuleBoundary';

const DesktopLayout = lazy(() => import('./desktop/DesktopLayout').then((module) => ({ default: module.DesktopLayout })));
const MobileLayout = lazy(() => import('./mobile/MobileLayout').then((module) => ({ default: module.MobileLayout })));
const TabletLayout = lazy(() => import('./tablet/TabletLayout').then((module) => ({ default: module.TabletLayout })));

export function AdaptiveLayout() {
    const { deviceType, isMobile, isTablet } = useDeviceType();
    const forceMobile = useAppStore(state => state.forceMobile);

    // Debug log to verify switching
    React.useEffect(() => {
        console.log(`[AdaptiveLayout] Switched to ${deviceType} mode`);
    }, [deviceType]);

    if (isMobile || forceMobile) {
        return <LazyModuleBoundary mode="overlay" label="Loading mobile layout..."><MobileLayout /></LazyModuleBoundary>;
    }

    if (isTablet) {
        return <LazyModuleBoundary mode="overlay" label="Loading tablet layout..."><TabletLayout /></LazyModuleBoundary>;
    }

    return <LazyModuleBoundary mode="overlay" label="Loading desktop layout..."><DesktopLayout /></LazyModuleBoundary>;
}
