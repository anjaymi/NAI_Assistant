/**
 * Tagger Service - Frontend wrapper for tagger-related Tauri commands
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * Check if tagger-server.exe exists in app_data directory
 */
export async function checkTaggerExists(): Promise<boolean> {
    try {
        return await invoke<boolean>('check_tagger_exists');
    } catch (e) {
        console.error('Failed to check tagger existence:', e);
        return false;
    }
}

/**
 * Get the download URL for tagger-server
 */
export async function getTaggerDownloadUrl(): Promise<string> {
    return await invoke<string>('get_tagger_download_url');
}

/**
 * Download tagger-server to app_data directory
 * Progress is emitted via 'tagger-download-progress' event
 */
export async function downloadTagger(): Promise<string> {
    return await invoke<string>('download_tagger');
}

/**
 * Start the local tagger server from app_data
 */
export async function startLocalTagger(): Promise<void> {
    await invoke('start_local_tagger');
}

/**
 * Ensure local tagger is running, checking and starting if needed
 * @returns true if tagger is ready, false if download is needed
 */
export async function ensureLocalTaggerReady(): Promise<boolean> {
    const exists = await checkTaggerExists();
    
    if (!exists) {
        return false; // Need to download
    }
    
    try {
        await startLocalTagger();
        // Give it a moment to start
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    } catch (e) {
        console.error('Failed to start local tagger:', e);
        return false;
    }
}
