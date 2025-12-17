import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMenu } from "../menu/useMenu";
import type { MenuGroup, MenuFunction } from "../menu/menuTypes";
import { useAuth } from "../auth/useAuth";

function Item({
  to,
  icon,
  label,
  collapsed,
  onNavigate,
  end,
  meta,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  onNavigate?: () => void;
  end?: boolean;
  meta?: string; // small right-side tag like "DASHBOARD"
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}
      title={collapsed ? label : undefined}
    >
      <span className="navicon">{icon}</span>
      <span className="navlabel">
        {label}
        {!collapsed && meta ? <span className="navmeta">{meta}</span> : null}
      </span>
    </NavLink>
  );
}

function normalizeTo(raw?: string | null) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // allow external links (optional)
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s; // later we can render <a> instead of <NavLink>
  }

  // already absolute
  if (s.startsWith("/")) return s;

  // if client saved "dashboard/xxx"
  if (s.startsWith("dashboard/")) return `/${s}`;

  // default: assume it's a dashboard sub-route
  return `/dashboard/${s}`;
}


function groupTag(g: MenuGroup) {
  // short & readable tag
  return (g.code || g.name || "GROUP").toUpperCase();
}

export default function Sidebar({
  collapsed = false,
  isOpen = true,
  onClose,
}: {
  collapsed?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  // keep it (even if not used now) to preserve your logic expectations
  const { user } = useAuth();
  void user;

  const { menu, loading, err } = useMenu();

  // Normalize backend (items/functions) + flatten to a simple list
  const dynamicLinks = useMemo(() => {
    const groups = (menu ?? []) as any[];

    const flat = groups.flatMap((g: any) => {
      const raw = (g.items ?? g.functions ?? []) as MenuFunction[];
      const tag = groupTag(g as MenuGroup);

      return raw
        .map((f: any) => ({
          id: f.id ?? `${g.id}-${f.code}`,
          groupTag: tag,
          label: f.name ?? f.code ?? "Untitled",
to: normalizeTo(f.path),
        }))
        .filter((x: any) => !!x.to);
    });

    // stable sort: groupTag then label (clean UX)
    flat.sort((a: any, b: any) => {
      const g = a.groupTag.localeCompare(b.groupTag);
      if (g !== 0) return g;
      return a.label.localeCompare(b.label);
    });

    return flat;
  }, [menu]);

  return (
    <aside
      className="sidebar sidebar--simple"
      data-collapsed={collapsed ? "true" : "false"}
      data-open={isOpen ? "true" : "false"}
      aria-hidden={!isOpen}
    >
      <div className="sidebar__inner">
        <div className="sbDivider" />

        <nav className="sidebar__section sidebar__section--simple">
          {/* Core routes */}
          <Item
            to="/dashboard"
            end
            icon={<span className="sbIcon">🏠</span>}
            label="Dashboard"
            collapsed={collapsed}
            onNavigate={onClose}
          />
          <Item
            to="/dashboard/users"
            icon={<span className="sbIcon">👥</span>}
            label="Users"
            collapsed={collapsed}
            onNavigate={onClose}
          />
          <Item
            to="/dashboard/roles"
            icon={<span className="sbIcon">🔐</span>}
            label="Roles & Permissions"
            collapsed={collapsed}
            onNavigate={onClose}
          />
          <Item
            to="/dashboard/menu"
            icon={<span className="sbIcon">⚙️</span>}
            label="Menu Builder"
            collapsed={collapsed}
            onNavigate={onClose}
          />

          <div className="sbDivider" style={{ marginTop: 10 }} />

          {/* Dynamic routes (super simple flat list) */}
          {loading ? (
            <div className="sbState">Loading menu…</div>
          ) : err ? (
            <div className="sbState">
              <div style={{ fontWeight: 900 }}>Menu failed to load</div>
              <div className="sbState__sub">{String(err)}</div>
            </div>
          ) : dynamicLinks.length === 0 ? (
            <div className="sbState">No dynamic menu items.</div>
          ) : (
            <div className="sbDyn">
              {!collapsed && <div className="sbDyn__title">Navigation</div>}

              {dynamicLinks.map((x: any) => (
                <Item
                  key={x.id}
                  to={x.to}
                  icon={<span className="sbIcon">↳</span>}
                  label={x.label}
                  meta={x.groupTag}
                  collapsed={collapsed}
                  onNavigate={onClose}
                />
              ))}
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
