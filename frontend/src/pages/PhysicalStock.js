import React, { useContext, useEffect, useMemo, useState } from "react";
import { api, formatErr } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ClipboardText, FloppyDisk, ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";

function fmt(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n || 0); }

export default function PhysicalStock() {
  const { siteId, sites } = useContext(SiteContext);
  const [stock, setStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({});  // key = `${site_id}|${item_id}` -> string
  const [adjust, setAdjust] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    const p = siteId ? { params: { site_id: siteId } } : {};
    const [s, h] = await Promise.all([api.get("/stock", p), api.get("/physical-stock", p)]);
    setStock(s.data); setHistory(h.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [siteId]);

  const rows = useMemo(() =>
    stock.filter((r) => [r.item_name, r.site_name, r.category].join(" ").toLowerCase().includes(q.toLowerCase())),
    [stock, q]);

  const keyOf = (r) => `${r.site_id}|${r.item_id}`;

  const variance = (r) => {
    const v = counts[keyOf(r)];
    if (v === undefined || v === "") return null;
    return +(parseFloat(v) - r.stock).toFixed(3);
  };

  const saveAll = async () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);
    if (entries.length === 0) return toast.error("Enter at least one physical count");
    setSaving(true);
    try {
      for (const [key, val] of entries) {
        const [site_id, item_id] = key.split("|");
        await api.post("/physical-stock", {
          item_id, site_id, counted_qty: parseFloat(val), adjust, notes: "",
        });
      }
      toast.success(`Saved ${entries.length} count${entries.length === 1 ? "" : "s"}${adjust ? " (system adjusted)" : ""}`);
      setCounts({}); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="bt-eyebrow">Audit</div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">Physical Stock Count</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Record what you actually counted on site. Variance vs system is logged. Enable "Auto-adjust" to reconcile system stock to your count.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item / site" className="rounded-sm sm:w-56" data-testid="physical-search" />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2 border border-zinc-300 rounded-sm">
            <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} data-testid="physical-adjust-toggle" />
            Auto-adjust
          </label>
          <Button onClick={saveAll} disabled={saving} className="rounded-sm bg-blue-600 hover:bg-blue-700 h-11" data-testid="save-physical-button">
            <FloppyDisk size={16} className="mr-2" /> {saving ? "Saving…" : "Save Counts"}
          </Button>
        </div>
      </header>

      <div className="bt-card overflow-x-auto">
        <table className="bt-table w-full min-w-[800px]">
          <thead>
            <tr>
              <th>Item</th><th>Site</th><th>Unit</th>
              <th className="text-right">System Qty</th>
              <th className="text-right">Physical Qty</th>
              <th className="text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = variance(r);
              return (
                <tr key={keyOf(r)} data-testid={`physical-row-${r.site_id}-${r.item_id}`}>
                  <td className="font-medium">{r.item_name}</td>
                  <td className="text-zinc-500">{r.site_name}</td>
                  <td>{r.unit}</td>
                  <td className="text-right bt-num">{fmt(r.stock)}</td>
                  <td className="text-right">
                    <Input type="number" value={counts[keyOf(r)] ?? ""}
                      onChange={(e) => setCounts({ ...counts, [keyOf(r)]: e.target.value })}
                      className="h-9 text-right w-32 inline-block"
                      data-testid={`physical-input-${r.item_id}`}
                      placeholder="—" />
                  </td>
                  <td className="text-right bt-num">
                    {v === null ? <span className="text-zinc-300">—</span> :
                      v === 0 ? <span className="bt-badge bt-status-ok">Match</span> :
                      v > 0 ? <span className="text-emerald-700">+{fmt(v)}</span> :
                      <span className="text-red-700">{fmt(v)}</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-zinc-500 py-10">No stock to count.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardText size={18} />
          <h2 className="font-display text-xl font-semibold">Audit History</h2>
        </div>
        <div className="bt-card overflow-x-auto">
          <table className="bt-table w-full min-w-[700px]">
            <thead><tr><th>Date</th><th>Item</th><th>Site</th><th className="text-right">System</th><th className="text-right">Counted</th><th className="text-right">Variance</th><th>By</th><th>Adjusted</th></tr></thead>
            <tbody>
              {history.map((h) => {
                const site = sites.find((s) => s.id === h.site_id);
                return (
                  <tr key={h.id} data-testid={`audit-row-${h.id}`}>
                    <td className="text-xs text-zinc-500">{h.created_at?.slice(0, 16).replace("T", " ")}</td>
                    <td className="font-medium">{h.item_name}</td>
                    <td className="text-zinc-500">{site?.name || "—"}</td>
                    <td className="text-right bt-num">{fmt(h.system_qty)}</td>
                    <td className="text-right bt-num">{fmt(h.counted_qty)}</td>
                    <td className="text-right bt-num">
                      {h.variance === 0 ? <span className="text-zinc-500">0</span> :
                       h.variance > 0 ? <span className="text-emerald-700">+{fmt(h.variance)}</span> :
                       <span className="text-red-700">{fmt(h.variance)}</span>}
                    </td>
                    <td className="text-zinc-500">{h.counted_by_name}</td>
                    <td>{h.adjusted ? <span className="bt-badge bt-status-high"><ArrowsClockwise size={12} className="mr-1" /> Yes</span> : <span className="text-zinc-400">—</span>}</td>
                  </tr>
                );
              })}
              {history.length === 0 && <tr><td colSpan={8} className="text-center text-zinc-500 py-10">No audits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
