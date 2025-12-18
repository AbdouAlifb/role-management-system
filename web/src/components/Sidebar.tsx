import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  meta?: string;
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

  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return s;
  if (s.startsWith("dashboard/")) return `/${s}`;

  return `/dashboard/${s}`;
}

function groupTag(g: MenuGroup) {
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
 const { user, permissions = [] } = useAuth() as any;

const can = (perm?: string | null) => {
  if (!perm) return true;
  return permissions.includes("*") || permissions.includes(perm);
};


  const { menu, loading, err } = useMenu();
  const loc = useLocation();

  const dynamicGroups = useMemo(() => {
    const groups = (menu ?? []) as any[];





    return groups
      .map((g: any) => {
        const raw = (g.items ?? g.functions ?? []) as any[];

       const children = raw
  .map((f: any) => ({
    id: f.id ?? `${g.id}-${f.code}`,
    label: f.name ?? f.code ?? "Untitled",
    to: normalizeTo(f.path),
    required: f.requiredPermissionKey ?? null,
  }))
  .filter((x: any) => !!x.to && can(x.required));

        return {
          id: g.id,
          code: g.code,
          name: g.name,
          tag: groupTag(g as MenuGroup),
          children,
        };
      })
      .filter((g: any) => g.children.length > 0)
      .sort((a: any, b: any) => (a.tag || "").localeCompare(b.tag || ""));
  }, [menu]);

  // ✅ Accordion: keep one open at a time (you can change to multi-open easily)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  // ✅ Auto-open the group that contains the active route
  useEffect(() => {
    const path = loc.pathname;
    const match = dynamicGroups.find((g: any) => g.children.some((c: any) => c.to === path));
    if (match) setOpenGroupId(match.id);
  }, [loc.pathname, dynamicGroups]);

  function toggleGroup(id: string) {
    setOpenGroupId((prev) => (prev === id ? null : id));
  }

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

{can("rbac.manage") && (
  <Item to="/dashboard/users" icon={<span className="sbIcon">👥</span>} label="Users" collapsed={collapsed} onNavigate={onClose} />
)}

{can("rbac.manage") && (
  <Item to="/dashboard/roles" icon={<span className="sbIcon">🔐</span>} label="Roles & Permissions" collapsed={collapsed} onNavigate={onClose} />
)}

{can("rbac.manage") && (
  <Item to="/dashboard/menu" icon={<span className="sbIcon">⚙️</span>} label="Menu Builder" collapsed={collapsed} onNavigate={onClose} />
)}


          <div className="sbDivider" style={{ marginTop: 10 }} />

          {/* Dynamic routes */}
          {loading ? (
            <div className="sbState">Loading menu…</div>
          ) : err ? (
            <div className="sbState">
              <div style={{ fontWeight: 900 }}>Menu failed to load</div>
              <div className="sbState__sub">{String(err)}</div>
            </div>
          ) : dynamicGroups.length === 0 ? (
            <div className="sbState">No dynamic menu items.</div>
          ) : (
            <div className="sbDyn">
              {!collapsed && <div className="sbDyn__title">Navigation</div>}

              {dynamicGroups.map((g: any) => {
                const isOpenGroup = openGroupId === g.id;

                return (
                  <div key={g.id} className="sbGroup">
                    {/* Group header */}
                    <button
                      type="button"
                      className={`sbGroupBtn ${isOpenGroup ? "open" : ""}`}
                      onClick={() => toggleGroup(g.id)}
                      title={collapsed ? `${g.tag} — ${g.name}` : undefined}
                    >
                      <span className="sbGroupLeft">
                        <span className="sbGroupTag">{g.tag}</span>
                        {!collapsed && <span className="sbGroupName">{g.name}</span>}
                      </span>
                      {!collapsed && <span className={`sbChevron ${isOpenGroup ? "open" : ""}`}>▸</span>}
                    </button>

                    {/* Children */}
                    {isOpenGroup && (
                      <div className="sbChildren">
                        {g.children.map((x: any) => (
                          <Item
                            key={x.id}
                            to={x.to}
                            icon={<span className="sbIcon">•</span>}
                            label={x.label}
                            collapsed={collapsed}
                            onNavigate={onClose}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* ✅ In-file CSS (drop-in) */}
      <style>{`
        .sbDyn__title{
          padding: 10px 12px 6px;
          font-size: 12px;
          font-weight: 900;
          opacity: .65;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .sbGroup{
          margin: 6px 8px;
        }

        .sbGroupBtn{
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid rgba(0,0,0,.06);
          background: rgba(0,0,0,.02);
          border-radius: 12px;
          padding: 10px 10px;
          cursor: pointer;
          transition: transform .08s ease, background .12s ease, border-color .12s ease;
        }

        .sbGroupBtn:hover{
          background: rgba(0,0,0,.04);
          border-color: rgba(0,0,0,.10);
        }

        .sbGroupBtn:active{
          transform: translateY(1px);
        }

        .sbGroupLeft{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }

        .sbGroupTag{
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          padding: 6px 8px;
          border-radius: 10px;
          background: rgba(99,102,241,.12); /* indigo tint */
          color: rgba(30,41,59,.95);
          flex: 0 0 auto;
        }

        .sbGroupName{
          font-weight: 800;
          opacity: .85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sbChevron{
          opacity:.65;
          transition: transform .14s ease;
          font-size: 14px;
        }
        .sbChevron.open{
          transform: rotate(90deg);
        }

        .sbChildren{
          padding: 6px 0 2px;
          margin-left: 6px;
        }

        /* Child items look slightly inset */
        .sbChildren .navitem{
          border-radius: 10px;
          margin: 2px 0;
          padding-left: 14px;
        }

        /* Slightly smaller bullet for children */
        .sbChildren .sbIcon{
          opacity:.7;
        }

        /* Make active item stand out more */
        .navitem.active{
          background: rgba(99,102,241,.12);
          font-weight: 900;
        }

        /* When sidebar is collapsed, keep group button compact */
        .sidebar[data-collapsed="true"] .sbGroupBtn{
          justify-content: center;
          padding: 10px 8px;
        }
        .sidebar[data-collapsed="true"] .sbGroupTag{
          padding: 7px 8px;
        }
      `}</style>
    </aside>
  );
}
  