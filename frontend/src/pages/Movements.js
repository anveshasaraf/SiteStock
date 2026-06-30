import React, { useContext, useEffect, useState } from "react";
import { api, formatErr, useAuth, API } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { Plus, DownloadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const META = {
  inward: { title: "Inward Entry", eyebrow: "Stock In", color: "text-emerald-700" },
  outward: { title: "Outward / Issue", eyebrow: "Stock Out", color: "text-blue-700" },
  consumption: { title: "Consumption", eyebrow: "Used At Site", color: "text-red-700" },
};

function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0); }

export default function Movements({ mode }) {
  const { user } = useAuth();
  const { sites, siteId } = useContext(SiteContext);
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_id: "", site_id: user?.role !== "admin" ? user?.site_id : siteId || "",
    quantity: 0, rate: 0, type: mode, reference: "", notes: "", issued_to: "",
  });

  const load = async () => {
    const params = { type: mode };
    if (siteId) params.site_id = siteId;
    const [a, b] = await Promise.all([
      api.get("/movements", { params }), api.get("/items"),
    ]);
    setRows(a.data); setItems(b.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode, siteId]);

  useEffect(() => { setForm((f) => ({ ...f, type: mode })); }, [mode]);

  const save = async () => {
    if (!form.item_id || !form.site_id || form.quantity <= 0)
      return toast.error("Item, site and quantity required");
    try {
      await api.post("/movements", form);
      toast.success("Saved");
      setOpen(false);
      setForm((f) => ({ ...f, quantity: 0, rate: 0, reference: "", notes: "", issued_to: "" }));
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const exportCsv = () => {
    const t = localStorage.getItem("bt_token");
    const params = new URLSearchParams({ type: mode });
    if (siteId) params.set("site_id", siteId);
    if (t) params.set("token", t);
    window.open(`${API}/export/movements?${params.toString()}`, "_self");
  };

  const meta = META[mode];

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">{meta.eyebrow}</div>
          <h1 className={`font-display text-4xl font-bold tracking-tight mt-1 ${meta.color}`}>{meta.title}</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportCsv} className="rounded-sm" data-testid={`export-${mode}-button`}>
            <DownloadSimple size={14} className="mr-2" /> Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid={`add-${mode}-button`}>
                <Plus size={14} className="mr-2" /> New {meta.title}
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
                    <SelectTrigger data-testid={`${mode}-item-select`}><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.id} data-testid={`${mode}-item-option-${it.id}`}>{it.name} ({it.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Site</Label>
                  <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}
                    disabled={user?.role !== "admin"}>
                    <SelectTrigger data-testid={`${mode}-site-select`}><SelectValue placeholder="Site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`${mode}-site-option-${s.id}`}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Quantity</Label><Input type="number" data-testid={`${mode}-quantity-input`} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value || 0) })} /></div>
                <div><Label>Rate (₹)</Label><Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value || 0) })} /></div>
                <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                {(mode === "outward" || mode === "consumption") && (
                  <div className="col-span-2"><Label>{mode === "outward" ? "Issued to" : "Used in"}</Label><Input value={form.issued_to} onChange={(e) => setForm({ ...form, issued_to: e.target.value })} /></div>
                )}
                <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save} data-testid={`save-${mode}-button`} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="bt-card">
        <table className="bt-table w-full">
          <thead>
            <tr>
              <th>Date</th><th>Item</th><th>Site</th>
              <th className="text-right">Qty</th><th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
              <th>{mode === "outward" ? "Issued To" : mode === "consumption" ? "Used In" : "Reference"}</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const site = sites.find((s) => s.id === r.site_id);
              return (
                <tr key={r.id} data-testid={`${mode}-row-${r.id}`}>
                  <td className="text-xs text-zinc-500">{r.created_at?.slice(0, 10)}</td>
                  <td className="font-medium">{r.item_name}</td>
                  <td className="text-zinc-500">{site?.name || "—"}</td>
                  <td className="text-right bt-num">{r.quantity}</td>
                  <td className="text-right bt-num">₹{inr(r.rate)}</td>
                  <td className="text-right bt-num">₹{inr(r.amount)}</td>
                  <td>{mode === "inward" ? r.reference : r.issued_to || r.reference}</td>
                  <td className="text-zinc-500">{r.notes}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-zinc-500 py-10">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
