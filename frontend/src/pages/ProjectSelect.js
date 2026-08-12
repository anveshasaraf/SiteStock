import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { HardHat, Buildings, ArrowRight, Gear, SignOut } from "@phosphor-icons/react";

const ROLE_COLOR = {
  site_admin: "bg-blue-100 text-blue-700",
  manager:    "bg-emerald-100 text-emerald-700",
  logger:     "bg-amber-100 text-amber-700",
  viewer:     "bg-zinc-100 text-zinc-600",
};

const ROLE_LABEL = {
  site_admin: "Site Admin",
  manager:    "Manager",
  logger:     "Logger",
  viewer:     "Viewer",
};

export default function ProjectSelect() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sites = user?.sites || [];

  // Auto-enter if the user has exactly one project
  React.useEffect(() => {
    if (sites.length === 1 && !user?.is_super_admin) {
      navigate(`/p/${sites[0].id}`, { replace: true });
    }
  }, [sites.length, user?.is_super_admin, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-white px-4 py-8 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 text-white grid place-items-center rounded-sm">
            <HardHat size={16} weight="fill" />
          </div>
          <span className="font-display font-bold">BuildTrack</span>
        </div>
        <div className="flex items-center gap-3">
          {user?.is_super_admin && (
            <button
              onClick={() => navigate("/org")}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 border border-zinc-200 px-3 py-1.5 rounded-sm transition-colors"
            >
              <Gear size={14} /> Org Admin
            </button>
          )}
          <button onClick={handleLogout}
            className="text-zinc-400 hover:text-zinc-700 transition-colors" title="Sign out">
            <SignOut size={18} />
          </button>
        </div>
      </header>

      {/* Greeting */}
      <div className="mb-6">
        <div className="bt-eyebrow">Welcome back</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
          {user?.name || "-"}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Select a project to continue</p>
      </div>

      {/* Project list */}
      {sites.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
          <Buildings size={48} className="text-zinc-200" />
          <p className="text-zinc-500">You haven't been added to any project yet.</p>
          <p className="text-zinc-400 text-sm">Ask your site manager or admin to add you.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => navigate(`/p/${site.id}`)}
              className="bt-card p-5 text-left hover:border-zinc-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-base truncate group-hover:text-blue-600 transition-colors">
                    {site.name}
                  </div>
                  {site.location && (
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{site.location}</div>
                  )}
                  {site.code && (
                    <div className="font-mono text-xs text-zinc-400 mt-1">{site.code}</div>
                  )}
                </div>
                <ArrowRight size={16} className="shrink-0 text-zinc-300 group-hover:text-blue-500 mt-1 transition-colors" />
              </div>
              <div className="mt-3">
                <span className={`bt-badge ${ROLE_COLOR[site.role] || "bg-zinc-100 text-zinc-500"}`}>
                  {ROLE_LABEL[site.role] || site.role}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
