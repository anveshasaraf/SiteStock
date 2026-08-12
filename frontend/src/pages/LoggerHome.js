/**
 * Logger Home - the blue-collar entry screen.
 * Shows exactly 3 big action buttons + a recent activity snapshot.
 * Designed for one-hand phone use; all targets ≥ 56px.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/auth";
import { useSite } from "./Layout";
import { ArrowDown, Fire, ClipboardText, Package, TrendUp, TrendDown } from "@phosphor-icons/react";

const ACTIONS = [
  {
    to:    "inward",
    label: "Record Delivery",
    sub:   "Material received on site",
    icon:  ArrowDown,
    color: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    to:    "consumption",
    label: "Log Usage",
    sub:   "Material used / consumed",
    icon:  Fire,
    color: "bg-red-600 hover:bg-red-700",
  },
  {
    to:    "physical-stock",
    label: "Count Stock",
    sub:   "Physical audit + photo",
    icon:  ClipboardText,
    color: "bg-blue-600 hover:bg-blue-700",
  },
];

function inr(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

export default function LoggerHome() {
  const navigate       = useNavigate();
  const { siteId }     = useParams();
  const { site, role } = useSite();
  const [summary,  setSummary]  = useState(null);
  const [recent,   setRecent]   = useState([]);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/p/${siteId}/dashboard`).then((r) => setSummary(r.data)).catch(() => {});
    api.get(`/p/${siteId}/movements`, { params: { page_size: 5 } }).then((r) => setRecent(r.data)).catch(() => {});
  }, [siteId]);

  // Managers / site_admins see the full dashboard instead of this stripped view
  useEffect(() => {
    if (role && ["manager", "site_admin"].includes(role)) {
      navigate(`/p/${siteId}/dashboard`, { replace: true });
    }
  }, [role, siteId, navigate]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-lg mx-auto">

      {/* Greeting */}
      <div>
        <div className="bt-eyebrow">{site?.name}</div>
        <h1 className="font-display text-2xl font-bold tracking-tight mt-0.5">What's happening?</h1>
      </div>

      {/* KPI strip - stock health at a glance */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bt-card p-4">
            <div className="bt-eyebrow">Low / Out</div>
            <div className="font-display text-3xl font-bold text-amber-600 mt-1 bt-num">
              {summary.low_stock_count}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">items need restocking</div>
          </div>
          <div className="bt-card p-4">
            <div className="bt-eyebrow">Stock Value</div>
            <div className="font-display text-2xl font-bold mt-1 bt-num">
              ₹{inr(summary.total_stock_value)}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">on hand</div>
          </div>
        </div>
      )}

      {/* Big action buttons */}
      <div className="space-y-3">
        <div className="bt-eyebrow">Actions</div>
        {ACTIONS.map(({ to, label, sub, icon: Icon, color }) => (
          <button
            key={to}
            onClick={() => navigate(`/p/${siteId}/${to}`)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-sm text-white ${color} transition-colors text-left`}
          >
            <div className="w-12 h-12 bg-white/20 rounded-sm grid place-items-center shrink-0">
              <Icon size={24} weight="bold" />
            </div>
            <div>
              <div className="font-semibold text-lg leading-tight">{label}</div>
              <div className="text-sm opacity-80 mt-0.5">{sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Recent entries */}
      {recent.length > 0 && (
        <div>
          <div className="bt-eyebrow mb-2">Recent Entries</div>
          <div className="bt-card divide-y divide-zinc-100">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-sm grid place-items-center shrink-0 ${
                    r.type === "inward" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>
                    {r.type === "inward" ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.item_name}</div>
                    <div className="text-xs text-zinc-500">{r.created_at?.slice(0, 10)}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold bt-num text-sm">{r.quantity}</div>
                  <div className="text-xs text-zinc-400 capitalize">{r.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viewer-only nudge */}
      {role === "viewer" && (
        <div className="bt-card p-5 text-center space-y-2">
          <Package size={32} className="text-zinc-300 mx-auto" />
          <p className="text-zinc-500 text-sm">You have view-only access to this project.</p>
          <button
            onClick={() => navigate(`/p/${siteId}/stock`)}
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            View Stock Register
          </button>
        </div>
      )}
    </div>
  );
}
