import React, { useContext, useEffect, useMemo, useState } from "react";
import { api, API } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { DownloadSimple } from "@phosphor-icons/react";

function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0); }

export default function Stock() {
  const { siteId } = useContext(SiteContext);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    const params = siteId ? { params: { site_id: siteId } } : {};
    api.get("/stock", params).then((r) => setRows(r.data)).catch(() => {});
  }, [siteId]);

  const filtered = useMemo(() => rows.filter((r) =>
    (status === "ALL" || r.status === status) &&
    [r.item_name, r.category, r.site_name].join(" ").toLowerCase().includes(q.toLowerCase())
  ), [rows, q, status]);

  const exportCsv = () => {
    const t = localStorage.getItem("bt_token");
    const url = `${API}/export/stock${siteId ? `?site_id=${siteId}` : ""}`;
    window.open(`${url}${url.includes("?") ? "&" : "?"}token=${t || ""}`, "_self");
  };

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">Live</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Stock Register</h1>
          <p className="text-sm text-zinc-500 mt-1">Inward − Outward − Consumption = On Hand.</p>
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

      <div className="bt-card">
        <table className="bt-table w-full">
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
    </div>
  );
}
