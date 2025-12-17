import { useAuth } from "../auth/useAuth";

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();

  return (
    <header className="topbar topbar--simple">
      <div className="tbLeft">
     <button className="tbBurger" onClick={onMenuClick} aria-label="Toggle sidebar" type="button">
  <span className="tbBurgerIcon" aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
</button>

      </div>

      <div className="tbRight">
        <div className="tbUser">
          <span className="tbDot" aria-hidden="true" />
          <span className="tbUser__name">{user?.username ?? "user"}</span>
        </div>

        <button className="tbLogout" onClick={logout} type="button">
          Logout
        </button>
      </div>
    </header>
  );
}
