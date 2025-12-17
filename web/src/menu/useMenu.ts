import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { readMenuCache, writeMenuCache, isMenuCacheFresh } from "./menuCache";

// Optional: if you already have auth permissions in the frontend, keep this.
// If not, it's fine — backend should already return only what the user can see.
function getPermissionKeys(user: any): string[] {
  const a = user?.permissionKeys;
  const b = user?.permissions;
  if (Array.isArray(a)) return a;
  if (Array.isArray(b)) return b;
  return [];
}
function hasPerm(keys: string[], required?: string | null) {
  if (!required) return true;
  return keys.includes(required);
}

function unwrapArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.groups)) return x.groups;
  return [];
}

function normalizeGroups(raw: any): MenuGroup[] {
  const groups = unwrapArray(raw) as MenuGroup[];

  return groups
    .map((g) => {
      // If backend returns join format: menuGroupFunctions[{sequence, menuFunction}]
      if (Array.isArray(g.menuGroupFunctions)) {
        const fns: MenuFunction[] = g.menuGroupFunctions
          .map((j) => ({
            ...j.menuFunction,
            sequence: j.sequence ?? j.menuFunction?.sequence ?? null,
          }))
          .filter(Boolean);

        return { ...g, functions: fns };
      }

      // If backend returns functions directly
      if (Array.isArray(g.functions)) return g;

      return { ...g, functions: [] };
    })
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name));
}


export function useMenu() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "no-tenant";

  const initial = useMemo(() => readMenuCache(tenantId), [tenantId]);

  const [menu, setMenu] = useState<any[]>(() => initial?.menu ?? []);
  const [loading, setLoading] = useState<boolean>(() => !initial?.menu?.length);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [err, setErr] = useState<any>(null);

  const refresh = useCallback(async () => {
    setSyncing(true);
    setErr(null);
    try {
      const raw = await api("/menu/me");
      const arr = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.items) ? (raw as any).items : [];
      setMenu(arr);
      writeMenuCache(tenantId, arr);
    } catch (e: any) {
      setErr(e?.data?.message || e?.message || String(e));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [tenantId]);

  useEffect(() => {
    const cached = readMenuCache(tenantId);

    // show cached immediately
    if (cached?.menu?.length) {
      setMenu(cached.menu);
      setLoading(false);
    }

    // revalidate only if missing or stale
    const shouldFetch = !cached?.menu?.length || !isMenuCacheFresh(cached);
    if (shouldFetch) refresh();
  }, [tenantId, refresh]);

  return { menu, loading, syncing, err, refresh };
}
