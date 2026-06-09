import { useEffect, useRef } from 'react';
import { useWildcardStore } from '@/stores/wildcard-store';
import { useArtistStore } from '@/stores/artist-store';

/**
 * 同步画师 Store（结构化数据）与通配符 Store（文本文件）。
 * 确保 '固定画师.txt' 和 '随机画师.txt' 内容与 Store 一致。
 */
export const useWildcardSync = () => {
    const { createFileFromContent, saveFile, files, refreshFromDB } = useWildcardStore();
    const { randomFixedArtists: fixedItems, getFixedArtistsString, randomPoolText: poolText } = useArtistStore();
    
    const hasRefreshed = useRef(false);

    // 1. 初始加载通配符 DB
    useEffect(() => {
        if (!hasRefreshed.current) {
            refreshFromDB().then(() => {
                console.log('[WildcardSync] Initial DB Refresh Complete');
            });
            hasRefreshed.current = true;
        }
    }, [refreshFromDB]);

    // 2. 同步固定画师 → 固定画师.txt（从结构化数据序列化）
    useEffect(() => {
        if (!hasRefreshed.current) return;

        const timeoutId = setTimeout(async () => {
            const fileName = '固定画师.txt';
            const fixedText = getFixedArtistsString();
            const existingFile = files.find(f => f.name === fileName);
            
            try {
                if (existingFile) {
                    if (existingFile.content !== fixedText) {
                        await saveFile(existingFile.id, fixedText);
                    }
                } else {
                    await createFileFromContent(fileName, fixedText || "");
                    console.log(`[WildcardSync] Created ${fileName}`);
                }
            } catch (e) {
                console.error(`[WildcardSync] Failed to sync ${fileName}`, e);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [fixedItems, files, saveFile, createFileFromContent, getFixedArtistsString]);

    // 3. 同步随机池 → 随机画师.txt
    useEffect(() => {
        if (!hasRefreshed.current) return;

        const timeoutId = setTimeout(async () => {
            const fileName = '随机画师.txt';
            const existingFile = files.find(f => f.name === fileName);
            
            try {
                if (existingFile) {
                    if (existingFile.content !== poolText) {
                        await saveFile(existingFile.id, poolText);
                    }
                } else {
                    await createFileFromContent(fileName, poolText || "");
                    console.log(`[WildcardSync] Created ${fileName}`);
                }
            } catch (e) {
                console.error(`[WildcardSync] Failed to sync ${fileName}`, e);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [poolText, files, saveFile, createFileFromContent]);
};
