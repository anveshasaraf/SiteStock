import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatErr, downloadFile } from "../lib/auth";
import { useSite } from "./Layout";
import { Button } from "../components/ui/button";
import { Input }  from "../components/ui/input";
import { Label }  from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { Plus, DownloadSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const META = {
  inward:      { title: "Inward Entry",    eyebrow: "Stock In",    color: "text-emerald-700" },
  outward:     { title: "Outward / Issue", eyebrow: "Stock Out",   color: "text-blue-700"    },
  consumption: { title: "Consumption",     eyebrow: "Used At Site",color: "text-red-700"     },
};

const PERIODS = [
  { label: "Last 7 days",  days: 7   },
  { label: "Last 30 days", days: 30  },
  { label: "Last 90 days", days: 90  },
  { label: "Last year",    days: 365 },
  { label: "All time",     days: null },
];

function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0); }

const BLANK = (mode) => ({
  item_id: "", quantity: 0, rate: 0, type: mode, reference: "", notes: "", issued_to: "",
});

const ROLE_LEVEL = { viewer: 1, logger: 2, manager: 3, site_admin: 4 };
const canDo = (role, min) => (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[min] || 0);

export default function Movements({ mode }) {
  const { siteId }          = useParams();
  const { role }            = useSite();
  const [rows,  setRows]    = useState([]);
  const [items, setItems]   = useState([]);
  const [open,  setOpen]    = useState(false);
  const [form,  setForm]    = useState(BLANK(mode));
  const [days,  setDays]    = useState(30);

  const load = () => {
    if (!siteId) return;
    const params = { type: mode };
    if (days !== null) params.days = days;
    Promise.all([
      api.get(`/p/${siteId}/movements`, { params }),
      api.get("/items"),
    ]).then(([a, b]) => { setRows(a.data); setItems(b.data); }).catch(() => {});
  };

  useEffect(() => { load(); }, [mode, siteId, days]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setForm(BLANK(mode)); }, [mode]);

  const save = async () => {
    if (!form.item_id || form.quantity <= 0)
      return toast.error("Item and quantity are required");
    try {
      await api.post(`/p/${siteId}/movements`, form);
      toast.success("Saved");
      setOpen(false);
      setForm(BLANK(mode));
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    try {
      await api.delete(`/p/${siteId}/movements/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Delete failed"); }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({ type: mode });
      if (days !== null) params.append("days", days);
      await downloadFile(`/p/${siteId}/movements?${params}`, `${mode}.csv`);
    } catch (e) { toast.error(e.message || "Download failed"); }
  };

  const meta = META[mode];
  const canDelete = canDo(role, "manager");

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="bt-eyebrow">{meta.eyebrow}</div>
          <h1 className={`font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1 ${meta.color}`}>
            {meta.title}
          </h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={exportCsv} className="rounded-sm flex-1 sm:flex-none">
            <DownloadSimple size={14} className="mr-2" /> Export
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none h-12 sm:h-10">
                <Plus size={16} className="mr-2" /> New {meta.title}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>New {meta.title.toLowerCase()}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Item</Label>
                  <Select value={form.item_id} onValueChange={(v) => {
                    const it = items.find((x) => x.id === v);
                    setForm({ ...form, item_id: v, rate: it?.rate || form.rate });
                  }}>
                    <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select item…" /></SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.id}>{it.name} ({it.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" inputMode="decimal" className="h-12 text-base"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Rate (₹)</Label>
                  <Input type="number" inputMode="decimal" className="h-12 text-base"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Reference</Label>
                  <Input className="h-11" value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
                {(mode === "outward" || mode === "consumption") && (
                  <div className="col-span-2">
                    <Label>{mode === "outward" ? "Issued to" : "Used in"}</Label>
                    <Input className="h-11" value={form.issued_to}
                      onChange={(e) => setForm({ ...form, issued_to: e.target.value })} />
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input className="h-11" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={save} className="h-12 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={String(p.days)}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 text-sm rounded-sm border transition-colors ${
              days === p.days
                ? "bg-zinc-900 text-white border-zinc-900"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="bt-card hidden md:block overflow-x-auto">
        <table className="bt-table w-full min-w-[700px]">
          <thead>
            <tr>
              <th>Date</th><th>Item</th>
              <th className="text-right">Qty</th><th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
              <th>{mode === "outward" ? "Issued To" : mode === "consumption" ? "Used In" : "Reference"}</th>
              <th>Notes</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-xs text-zinc-500 whitespace-nowrap">{r.created_at?.slice(0, 16).replace("T", " ")}</td>
                <td className="font-medium">{r.item_name}</td>
                <td className="text-right bt-num">{r.quantity}</td>
                <td className="text-right bt-num">₹{inr(r.rate)}</td>
                <td className="text-right bt-num">₹{inr(r.amount)}</td>
                <td>{mode === "inward" ? r.reference : r.issued_to || r.reference}</td>
                <td className="text-zinc-500">{r.notes}</td>
                {canDelete && (
                  <td>
                    <button onClick={() => del(r.id)} className="text-zinc-300 hover:text-red-500 transition-colors p-1">
                      <Trash size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={canDelete ? 8 : 7} className="text-center text-zinc-500 py-10">No entries for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="bt-card p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="bt-eyebrow">{r.created_at?.slice(0, 10)}</div>
                <div className="font-semibold truncate">{r.item_name}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {r.issued_to ? `→ ${r.issued_to}` : r.reference || ""}
                </div>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                <div className="text-right">
                  <div className="bt-num font-bold text-lg">{r.quantity}</div>
                  <div className="text-xs text-zinc-500">₹{inr(r.amount)}</div>
                </div>
                {canDelete && (
                  <button onClick={() => del(r.id)} className="text-zinc-300 hover:text-red-500 transition-colors mt-1">
                    <Trash size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-zinc-500 py-10">No entries for this period.</div>}
      </div>
    </div>
  );
}
