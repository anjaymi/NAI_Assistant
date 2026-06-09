import { invoke, InvokeArgs } from '@tauri-apps/api/core';

export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * 带有超时机制的 Tauri IPC 调用封装
 * 
 * 用于保护前端主线程，避免因 Rust 端进程挂起（如极耗时的模型加载、网络请求卡死）
 * 导致的前端 Promise 永远不 Resolve/Reject。
 *
 * @param cmd The command to invoke.
 * @param args The arguments to pass to the command.
 * @param timeoutMs The timeout in milliseconds (default: 30000ms - 30s).
 * @returns The command result.
 */
export async function invokeWithTimeout<T>(cmd: string, args?: InvokeArgs, timeoutMs: number = 30000): Promise<T> {
    let timeoutId: number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(new TimeoutError(`IPC Call '${cmd}' timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([
            invoke<T>(cmd, args),
            timeoutPromise
        ]);
        return result;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
