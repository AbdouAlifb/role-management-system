import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { readMenuCache } from "../menu/menuCache";

function findLabelByPath(menu: any[], path: string) {
  for (const g of menu || []) {
    const items = g?.items ?? g?.functions ?? [];
    for (const f of items) {
      const p = typeof f?.path === "string" ? f.path.trim() : "";
      if (p === path) return f?.name ?? f?.code ?? null;
    }
  }
  return null;
}

export default function ComingSoonPage() {
  const { user } = useAuth();
  const loc = useLocation();

  const tenantId = user?.tenantId ?? "no-tenant";
  const cached = readMenuCache(tenantId);
  const title = findLabelByPath(cached?.menu ?? [], loc.pathname) ?? loc.pathname;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ opacity: 0.7, fontWeight: 700, letterSpacing: 0.2 }}>MODULE</div>
      <h1 style={{ margin: "8px 0 6px" }}>{title}</h1>
      <div style={{ opacity: 0.75, maxWidth: 720 }}>
        This page is registered in the menu but not implemented yet.
      </div>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
        <div style={{ fontWeight: 800 }}>Route</div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 6 }}>
          {loc.pathname}
        </div>
      </div>
    </div>
  );
}
