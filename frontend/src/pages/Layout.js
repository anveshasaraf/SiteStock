import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth, api } from "../lib/auth";
import {
  HardHat, House, Package, Buildings, Truck, Receipt,
  ArrowDown, ArrowUp, Fire, ChartBar, Users as UsersIcon,
  SignOut, CaretDown, List, X,
} from "@phosphor-icons/react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "../components/ui/dropdown-menu";

export const SiteContext = React.createContext({ sites: [], siteId: "", setSiteId: () => {} });

const NAV = [
  { to: "/", label: "Dashboard", short: "Home", icon: House, end: true },
  { to: "/stock", label: "Stock Register", short: "Stock", icon: Package },
  { to: "/invoices", label: "Purchase Invoices", short: "Bills", icon: Receipt },
  { to: "/inward", label: "Inward Entry", short: "In", icon: ArrowDown },
  { to: "/outward", label: "Outward Issue", short: "Out", icon: ArrowUp },
  { to: "/consumption", label: "Consumption", short: "Use", icon: Fire },
  { to: "/items", label: "Items Master", short: "Items", icon: Package },
  { to: "/suppliers", label: "Suppliers", short: "Vendors", icon: Truck },
  { to: "/reports", label: "Reports / Export", short: "Reports", icon: ChartBar },
];
const ADMIN_NAV = [
  { to: "/sites", label: "Sites", icon: Buildings },
  { to: "/users", label: "Users", icon: UsersIcon },
];

// Bottom-nav: the 5 most-used actions for staff
const MOBILE_BOTTOM = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/invoices", label: "Bills", icon: Receipt },
  { to: "/inward", label: "In", icon: ArrowDown },
  { to: "/consumption", label: "Use", icon: Fire },
  { to: "/stock", label: "Stock", icon: Package },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.get("/sites").then((r) => {
      setSites(r.data);
      if (user?.role !== "admin" && user?.site_id) setSiteId(user.site_id);
    }).catch(() => {});
  }, [user]);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await logout(); nav("/login"); };

  const currentSite = siteId ? sites.find((s) => s.id === siteId)?.name || "" : "All Sites";

  const SidebarBody = (
    <>
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
        <button onClick={() => setDrawerOpen(false)} className="md:hidden text-zinc-500" data-testid="close-drawer">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 border-b border-zinc-200">
        <div className="bt-eyebrow mb-2">Site</div>
        {user?.role === "admin" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="site-selector-dropdown" className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-zinc-300 bg-white rounded-sm hover:border-zinc-900 transition-colors">
                <span className="truncate">{currentSite}</span>
                <CaretDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Select site</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSiteId("")} data-testid="site-option-all">All Sites</DropdownMenuItem>
              <DropdownMenuSeparator />
              {sites.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setSiteId(s.id)} data-testid={`site-option-${s.id}`}>{s.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="px-3 py-2 text-sm border border-zinc-300 bg-white rounded-sm">{currentSite || "Not assigned"}</div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            data-testid={`nav-${n.to.replace("/", "") || "dashboard"}`}
            className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}>
            <n.icon size={16} />
            {n.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <>
            <div className="bt-eyebrow px-3 pt-4 pb-1">Admin</div>
            {ADMIN_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} data-testid={`nav-${n.to.replace("/", "")}`}
                className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}>
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 bg-zinc-900 text-white grid place-items-center rounded-sm font-bold">
            {(user?.name || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{user?.role}</div>
          </div>
          <button data-testid="logout-button" onClick={handleLogout} className="text-zinc-500 hover:text-zinc-900 transition-colors" title="Sign out">
            <SignOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <SiteContext.Provider value={{ sites, siteId, setSiteId, refreshSites: () =>
      api.get("/sites").then((r) => setSites(r.data)).catch(() => {}) }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-white text-zinc-900">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 bg-white">
          <button onClick={() => setDrawerOpen(true)} className="p-2 -m-2 text-zinc-700" data-testid="open-drawer" aria-label="Open menu">
            <List size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-zinc-900 text-white grid place-items-center rounded-sm">
              <HardHat size={14} weight="fill" />
            </div>
            <span className="font-display font-bold">BuildTrack</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 max-w-[40%] truncate">{currentSite}</div>
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

        <main className="flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white" data-testid="mobile-bottom-nav">
          {MOBILE_BOTTOM.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-[0.14em] font-bold transition-colors ${
                  isActive ? "text-blue-600" : "text-zinc-500"
                }`}>
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </SiteContext.Provider>
  );
}
