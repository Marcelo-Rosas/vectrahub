import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'vite:chunk-reload';

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(
    msg
  );
}

/** Lazy import com 1 reload automático após deploy (chunk hash mudou). */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

export function reloadForChunkError(): void {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  window.location.reload();
}
