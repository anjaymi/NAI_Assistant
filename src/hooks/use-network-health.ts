import { useState, useEffect } from 'react';
import { pingLanHost, discoverLanPcIp } from '@/services/cloud-push-service';
import { useSettingsStore } from '@/stores/settings-store';

export interface NetworkHealth {
    lanReady: boolean;
    cloudReady: boolean;
}

const listeners = new Set<(lanReady: boolean) => void>();

let sharedLanReady = false;
let activeSubscriberCount = 0;
let activeToken = '';
let discoverTimeoutId: number | null = null;
let pingTimeoutId: number | null = null;
let pollingVersion = 0;
let visibilityListenerAttached = false;
let sharedIsVisible = typeof document === 'undefined' ? true : document.visibilityState === 'visible';

function notifyLanReady() {
    listeners.forEach((listener) => listener(sharedLanReady));
}

function setSharedLanReady(nextLanReady: boolean) {
    if (sharedLanReady === nextLanReady) return;
    sharedLanReady = nextLanReady;
    notifyLanReady();
}

function clearDiscoverTimeout() {
    if (discoverTimeoutId !== null) {
        window.clearTimeout(discoverTimeoutId);
        discoverTimeoutId = null;
    }
}

function clearPingTimeout() {
    if (pingTimeoutId !== null) {
        window.clearTimeout(pingTimeoutId);
        pingTimeoutId = null;
    }
}

function clearSharedTimeouts() {
    clearDiscoverTimeout();
    clearPingTimeout();
}

function shouldPoll(token: string) {
    return !!token && activeSubscriberCount > 0 && sharedIsVisible;
}

function ensureVisibilityListener() {
    if (visibilityListenerAttached || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
        sharedIsVisible = document.visibilityState === 'visible';
        if (!sharedIsVisible) {
            clearSharedTimeouts();
            setSharedLanReady(false);
            return;
        }

        restartSharedPolling(activeToken);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerAttached = true;
}

function stopSharedPolling() {
    pollingVersion += 1;
    clearSharedTimeouts();
    setSharedLanReady(false);
}

function scheduleDiscover(version: number) {
    clearDiscoverTimeout();
    discoverTimeoutId = window.setTimeout(() => {
        void runDiscoverLoop(version);
    }, 30000);
}

function schedulePing(version: number) {
    clearPingTimeout();
    pingTimeoutId = window.setTimeout(() => {
        void runPingLoop(version);
    }, 12000);
}

async function runDiscoverLoop(version: number) {
    if (version !== pollingVersion || !shouldPoll(activeToken)) return;

    const { lanPcIp, setLanPcIp } = useSettingsStore.getState();

    if (!lanPcIp || !sharedLanReady) {
        const discoveredIp = await discoverLanPcIp(activeToken);
        if (version !== pollingVersion || !shouldPoll(activeToken)) return;

        if (discoveredIp && discoveredIp !== useSettingsStore.getState().lanPcIp) {
            setLanPcIp(discoveredIp);
            if (pingTimeoutId === null) {
                void runPingLoop(version);
            }
        }
    }

    scheduleDiscover(version);
}

async function runPingLoop(version: number) {
    if (version !== pollingVersion || !shouldPoll(activeToken)) return;

    const { lanPcIp } = useSettingsStore.getState();
    if (!lanPcIp) {
        setSharedLanReady(false);
        schedulePing(version);
        return;
    }

    const isAlive = await pingLanHost(lanPcIp);
    if (version !== pollingVersion || !shouldPoll(activeToken)) return;

    setSharedLanReady(isAlive === true);
    schedulePing(version);
}

function restartSharedPolling(token: string) {
    activeToken = token;
    pollingVersion += 1;
    clearSharedTimeouts();

    if (!shouldPoll(token)) {
        setSharedLanReady(false);
        return;
    }

    const version = pollingVersion;
    void runDiscoverLoop(version);
    void runPingLoop(version);
}

export function useNetworkHealth(cloudSyncToken: string | null | undefined): NetworkHealth {
    const [lanReady, setLanReady] = useState(sharedLanReady);
    const cloudReady = !!cloudSyncToken && cloudSyncToken.length > 5;

    useEffect(() => {
        const listener = (nextLanReady: boolean) => setLanReady(nextLanReady);
        listeners.add(listener);
        listener(sharedLanReady);

        return () => {
            listeners.delete(listener);
        };
    }, []);

    useEffect(() => {
        ensureVisibilityListener();

        if (!cloudSyncToken) {
            setLanReady(false);
            return;
        }

        activeSubscriberCount += 1;
        restartSharedPolling(cloudSyncToken);

        return () => {
            activeSubscriberCount = Math.max(0, activeSubscriberCount - 1);
            if (activeSubscriberCount === 0) {
                activeToken = '';
                stopSharedPolling();
            }
        };
    }, [cloudSyncToken]);

    return { lanReady, cloudReady };
}
