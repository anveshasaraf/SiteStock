import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { DownloadSimple } from "@phosphor-icons/react";

function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0); }

export default function Stock() {
  const { siteId } = useParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    if (!siteId) return;
    const params = {};
    if (status !== "ALL") params.status = status;
    if (q) params.q = q;
    api.get(`/p/${siteId}/stock`, { params }).then((r) => setRows(r.data)).catch(() => {});
  }, [siteId, status, q]);

  const filtered = useMemo(() => rows.filter((r) =>
    [r.item_name, r.category].join(" ").toLowerCase().includes(q.toLowerCase())
  ), [rows, q]);

  const exportCsv = async () => {
    try {
      const mod = await import("../lib/auth");
      await mod.downloadFile(`/p/${siteId}/export/stock`, "stock_register.csv");
    } catch (e) { /* eslint-disable-next-line no-alert */ alert(e.message || "Download failed"); }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="bt-eyebrow">Live</div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">Stock Register</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">Inward − Outward − Consumption = On Hand.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 rounded-sm" data-testid="stock-search-input" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" data-testid="stock-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All status</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="OUT">Out</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-sm" onClick={exportCsv} data-testid="export-stock-button">
            <DownloadSimple size={14} className="mr-2" /> Export CSV
          </Button>
        </div>
      </header>

      <div className="bt-card overflow-x-auto hidden md:block">
        <table className="bt-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th>Item</th><th>Site</th><th>Category</th><th>Unit</th>
              <th className="text-right">Inward</th><th className="text-right">Outward</th>
              <th className="text-right">Consumed</th><th className="text-right">On Hand</th>
              <th className="text-right">Min</th><th className="text-right">Max</th>
              <th className="text-right">Value</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} data-testid={`stock-row-${r.site_id}-${r.item_id}`}>
                <td className="font-medium">{r.item_name}</td>
                <td className="text-zinc-500">{r.site_name}</td>
                <td className="text-zinc-500">{r.category}</td>
                <td>{r.unit}</td>
                <td className="text-right bt-num text-emerald-700">{r.inward}</td>
                <td className="text-right bt-num">{r.outward}</td>
                <td className="text-right bt-num">{r.consumption}</td>
                <td className="text-right bt-num font-semibold">{r.stock}</td>
                <td className="text-right bt-num text-zinc-500">{r.min_stock || `~${r.auto_min_stock}`}</td>
                <td className="text-right bt-num text-zinc-500">{r.max_stock || "—"}</td>
                <td className="text-right bt-num">₹{inr(r.value)}</td>
                <td>
                  <span className={`bt-badge ${
                    r.status === "OUT" ? "bt-status-out" :
                    r.status === "LOW" ? "bt-status-low" :
                    r.status === "HIGH" ? "bt-status-high" : "bt-status-ok"
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={12} className="text-center text-zinc-500 py-10">No stock to show.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r, i) => (
          <div key={i} className="bt-card p-4" data-testid={`stock-card-${r.site_id}-${r.item_id}`}>
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="bt-eyebrow">{r.site_name}</div>
                <div className="font-semibold truncate">{r.item_name}</div>
                <div className="text-xs text-zinc-500">{r.category}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-display font-bold bt-num">{r.stock}</div>
                <div className="text-xs text-zinc-500">{r.unit}</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 text-xs">
              <div className="space-x-3">
                <span className="text-emerald-700">In {r.inward}</span>
                <span className="text-blue-700">Out {r.outward}</span>
                <span className="text-red-700">Used {r.consumption}</span>
              </div>
              <span className={`bt-badge ${
                r.status === "OUT" ? "bt-status-out" :
                r.status === "LOW" ? "bt-status-low" :
                r.status === "HIGH" ? "bt-status-high" : "bt-status-ok"
              }`}>{r.status}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-zinc-500 py-10">No stock to show.</div>}
      </div>
    </div>
  );
}
