const MENU_CACHE_VERSION = 1;
const MENU_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function menuCacheKey(tenantId: string) {
  return `menu_cache_v${MENU_CACHE_VERSION}:${tenantId}`;
}

export function readMenuCache(tenantId: string): { ts: number; menu: any[] } | null {
  try {
    const raw = localStorage.getItem(menuCacheKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.menu)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMenuCache(tenantId: string, menu: any[]) {
  try {
    localStorage.setItem(menuCacheKey(tenantId), JSON.stringify({ ts: Date.now(), menu }));
  } catch {
    // ignore storage errors
  }
}

export function isMenuCacheFresh(cache: { ts: number }, ttlMs = MENU_CACHE_TTL_MS) {
  return Date.now() - cache.ts < ttlMs;
}

export function clearMenuCache(tenantId: string) {
  try {
    localStorage.removeItem(menuCacheKey(tenantId));
  } catch {}
}
