import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);

    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);

    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export default function DashboardLayout() {
  const isMobile = useMediaQuery("(max-width: 980px)");
  const [collapsed, setCollapsed] = useState(false); // desktop collapse (icons-only)
  const [mobileOpen, setMobileOpen] = useState(false); // mobile off-canvas open

  const location = useLocation();

  // close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // if we switch to desktop, ensure off-canvas is closed
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const onMenuClick = () => {
    if (isMobile) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div
      className={[
        "layout",
        collapsed ? "layout--collapsed" : "",
        mobileOpen ? "layout--mobileSidebarOpen" : "",
      ].join(" ")}
    >
      <Topbar onMenuClick={onMenuClick} />

      <div className="layout__body">
        {/* mobile overlay */}
        <button
          className="scrim"
          onClick={closeMobile}
          aria-label="Close sidebar overlay"
          aria-hidden={!mobileOpen}
          tabIndex={mobileOpen ? 0 : -1}
        />

        <Sidebar
          collapsed={!isMobile && collapsed}
          isOpen={isMobile ? mobileOpen : true}
          onClose={closeMobile}
        />

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
