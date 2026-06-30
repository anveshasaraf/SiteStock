import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth, api } from "../lib/auth";
import {
  HardHat, House, Package, Buildings, Truck, Receipt,
  ArrowDown, ArrowUp, Fire, ChartBar, Users as UsersIcon,
  SignOut, CaretDown,
} from "@phosphor-icons/react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "../components/ui/dropdown-menu";

export const SiteContext = React.createContext({ sites: [], siteId: "", setSiteId: () => {} });

const NAV = [
  { to: "/", label: "Dashboard", icon: House, end: true },
  { to: "/stock", label: "Stock Register", icon: Package },
  { to: "/invoices", label: "Purchase Invoices", icon: Receipt },
  { to: "/inward", label: "Inward Entry", icon: ArrowDown },
  { to: "/outward", label: "Outward Issue", icon: ArrowUp },
  { to: "/consumption", label: "Consumption", icon: Fire },
  { to: "/items", label: "Items Master", icon: Package },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/reports", label: "Reports / Export", icon: ChartBar },
];
const ADMIN_NAV = [
  { to: "/sites", label: "Sites", icon: Buildings },
  { to: "/users", label: "Users", icon: UsersIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");

  useEffect(() => {
    api.get("/sites").then((r) => {
      setSites(r.data);
      if (user?.role !== "admin" && user?.site_id) setSiteId(user.site_id);
    }).catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  const currentSite = siteId
    ? sites.find((s) => s.id === siteId)?.name || ""
    : "All Sites";

  return (
    <SiteContext.Provider value={{ sites, siteId, setSiteId, refreshSites: () =>
      api.get("/sites").then((r) => setSites(r.data)).catch(() => {}) }}>
      <div className="min-h-screen flex bg-white text-zinc-900">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col">
          <div className="px-5 py-5 border-b border-zinc-200 flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 text-white grid place-items-center rounded-sm">
              <HardHat size={18} weight="fill" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none">BuildTrack</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">
                Inventory OS
              </div>
            </div>
          </div>

          {/* Site selector */}
          <div className="p-4 border-b border-zinc-200">
            <div className="bt-eyebrow mb-2">Site</div>
            {user?.role === "admin" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="site-selector-dropdown"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-zinc-300 bg-white rounded-sm hover:border-zinc-900 transition-colors"
                  >
                    <span className="truncate">{currentSite}</span>
                    <CaretDown size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Select site</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSiteId("")} data-testid="site-option-all">
                    All Sites
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {sites.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => setSiteId(s.id)}
                      data-testid={`site-option-${s.id}`}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="px-3 py-2 text-sm border border-zinc-300 bg-white rounded-sm">
                {currentSite || "Not assigned"}
              </div>
            )}
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`nav-${n.to.replace("/", "") || "dashboard"}`}
                className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}
              >
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <>
                <div className="bt-eyebrow px-3 pt-4 pb-1">Admin</div>
                {ADMIN_NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    data-testid={`nav-${n.to.replace("/", "")}`}
                    className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}
                  >
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
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {user?.role}
                </div>
              </div>
              <button
                data-testid="logout-button"
                onClick={handleLogout}
                className="text-zinc-500 hover:text-zinc-900 transition-colors"
                title="Sign out"
              >
                <SignOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </SiteContext.Provider>
  );
}
