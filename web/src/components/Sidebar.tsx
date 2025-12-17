import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

function Item({
  to,
  icon,
  label,
  collapsed,
  onNavigate,
  end,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  onNavigate?: () => void;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end} // ✅ fixes /dashboard being active for nested routes
      onClick={onNavigate}
      className={({ isActive }) => `navitem ${isActive ? "active" : ""}`}
      title={collapsed ? label : undefined}
    >
      <span className="navicon">{icon}</span>
      <span className="navlabel">{label}</span>
    </NavLink>
  );
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
            to="/dashboard/settings"
            icon={<span className="sbIcon">⚙️</span>}
            label="Settings"
            collapsed={collapsed}
            onNavigate={onClose}
          />
        </nav>
      </div>
    </aside>
  );
}
