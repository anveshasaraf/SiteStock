import React, { createContext, useContext, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth, api } from "../lib/auth";
import {
  HardHat, House, Package, Truck, Receipt,
  ArrowDown, ArrowUp, Fire, ChartBar,
  SignOut, List, X, ClipboardText, ArrowLeft,
  Lightning,
} from "@phosphor-icons/react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";

export const SiteContext = createContext({ site: null, role: null, refreshSite: () => {} });
export const useSite = () => useContext(SiteContext);

// ── Role-gated nav definitions ───────────────────────────────────────────────
// Each entry specifies minRole — items only show if user has that role or higher.

const ROLE_LEVEL = { viewer: 1, logger: 2, manager: 3, site_admin: 4 };

const NAV = [
  { to: "",              label: "Quick Log",       short: "Log",   icon: Lightning,     minRole: "logger"  },
  { to: "dashboard",     label: "Dashboard",       short: "Home",  icon: House,         minRole: "viewer"  },
  { to: "stock",         label: "Stock Register",  short: "Stock", icon: Package,       minRole: "viewer"  },
  { to: "physical-stock",label: "Physical Count",  short: "Audit", icon: ClipboardText, minRole: "logger"  },
  { to: "invoices",      label: "Purchase Bills",  short: "Bills", icon: Receipt,       minRole: "logger"  },
  { to: "inward",        label: "Inward Entry",    short: "In",    icon: ArrowDown,     minRole: "logger"  },
  { to: "outward",       label: "Outward Issue",   short: "Out",   icon: ArrowUp,       minRole: "logger"  },
  { to: "consumption",   label: "Consumption",     short: "Use",   icon: Fire,          minRole: "logger"  },
  { to: "items",         label: "Items Master",    short: "Items", icon: Package,       minRole: "manager" },
  { to: "suppliers",     label: "Suppliers",       short: "Vend",  icon: Truck,         minRole: "manager" },
  { to: "reports",       label: "Reports / Export",short: "Rpt",   icon: ChartBar,      minRole: "viewer"  },
];

const MOBILE_BOTTOM = [
  { to: "",              label: "Log",   icon: Lightning,  minRole: "logger" },
  { to: "invoices",      label: "Bills", icon: Receipt,    minRole: "logger" },
  { to: "inward",        label: "In",    icon: ArrowDown,  minRole: "logger" },
  { to: "consumption",   label: "Use",   icon: Fire,       minRole: "logger" },
  { to: "stock",         label: "Stock", icon: Package,    minRole: "viewer" },
];

function canSee(role, minRole) {
  if (!role) return false;
  return (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

// ── Layout ───────────────────────────────────────────────────────────────────

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const { siteId }       = useParams();

  const [site,        setSite]        = useState(null);
  const [role,        setRole]        = useState(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/p/${siteId}/info`)
      .then((r) => { setSite(r.data); setRole(r.data.role); })
      .catch(() => { toast.error("Project not found or access denied"); navigate("/projects"); });
  }, [siteId, navigate]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const visibleNav    = NAV.filter((n) => canSee(role, n.minRole));
  const visibleBottom = MOBILE_BOTTOM.filter((n) => canSee(role, n.minRole));

  const SidebarBody = (
    <>
      {/* Brand header */}
      <div className="px-5 py-5 border-b border-zinc-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 text-white grid place-items-center rounded-sm">
            <HardHat size={18} weight="fill" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-none">BuildTrack</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">Inventory OS</div>
          </div>
        </div>
        <button onClick={() => setDrawerOpen(false)} className="md:hidden text-zinc-500">
          <X size={20} />
        </button>
      </div>

      {/* Project info (replaces site dropdown) */}
      <div className="px-4 py-3 border-b border-zinc-200">
        <div className="bt-eyebrow mb-1">Project</div>
        <div className="font-semibold text-sm truncate">{site?.name || "…"}</div>
        {site?.location && <div className="text-xs text-zinc-500 truncate">{site.location}</div>}
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1.5"
        >
          <ArrowLeft size={11} /> Switch project
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((n) => {
          const path = n.to ? `/p/${siteId}/${n.to}` : `/p/${siteId}`;
          return (
            <NavLink key={n.to} to={path} end={!n.to}
              className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}>
              <n.icon size={16} />
              {n.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-zinc-200 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 bg-zinc-900 text-white grid place-items-center rounded-sm font-bold text-sm">
            {(user?.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 capitalize">{role}</div>
          </div>
          <button onClick={handleLogout} className="text-zinc-500 hover:text-zinc-900 transition-colors" title="Sign out">
            <SignOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <SiteContext.Provider value={{ site, role, refreshSite: () => api.get(`/p/${siteId}/info`).then(r => setSite(r.data)) }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-white text-zinc-900">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 bg-white">
          <button onClick={() => setDrawerOpen(true)} className="p-2 -m-2 text-zinc-700" aria-label="Menu">
            <List size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-zinc-900 text-white grid place-items-center rounded-sm">
              <HardHat size={13} weight="fill" />
            </div>
            <span className="font-display font-bold text-sm">{site?.name || "BuildTrack"}</span>
          </div>
          <div className="w-8" /> {/* spacer */}
        </header>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 flex-col">
          {SidebarBody}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-zinc-50 flex flex-col">
              {SidebarBody}
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav (role-filtered) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-200 bg-white"
          style={{ display: "grid", gridTemplateColumns: `repeat(${visibleBottom.length}, 1fr)` }}>
          {visibleBottom.map((n) => {
            const path = n.to ? `/p/${siteId}/${n.to}` : `/p/${siteId}`;
            return (
              <NavLink key={n.to} to={path} end={!n.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] uppercase tracking-[0.14em] font-bold transition-colors min-h-[56px] ${
                    isActive ? "text-blue-600" : "text-zinc-400"
                  }`}>
                <n.icon size={22} />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </SiteContext.Provider>
  );
}
