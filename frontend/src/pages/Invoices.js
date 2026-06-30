import React, { useContext, useEffect, useState } from "react";
import { api, formatErr, API } from "../lib/auth";
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
import { Plus, Trash, DownloadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";

function today() { return new Date().toISOString().slice(0, 10); }
function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0); }

const emptyLine = { item_id: "", item_name: "", unit: "", quantity: 1, rate: 0, amount: 0 };

export default function Invoices() {
  const { user } = useAuth();
  const { sites, siteId } = useContext(SiteContext);
  const [invoices, setInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);

  const [inv, setInv] = useState({
    invoice_number: "", supplier_id: "", supplier_name: "",
    site_id: user?.role !== "admin" ? user?.site_id : (siteId || ""),
    invoice_date: today(), gst_percent: 18, lines: [{ ...emptyLine }], notes: "",
  });

  const load = async () => {
    const params = siteId ? { params: { site_id: siteId } } : {};
    const [a, b, c] = await Promise.all([
      api.get("/invoices", params), api.get("/items"), api.get("/suppliers"),
    ]);
    setInvoices(a.data); setItems(b.data); setSuppliers(c.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [siteId]);

  const updateLine = (i, patch) => {
    setInv((s) => {
      const lines = s.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l);
      lines[i].amount = +(lines[i].quantity * lines[i].rate).toFixed(2);
      return { ...s, lines };
    });
  };

  const pickItem = (i, itemId) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    updateLine(i, { item_id: it.id, item_name: it.name, unit: it.unit, rate: it.rate || 0 });
  };

  const addLine = () => setInv((s) => ({ ...s, lines: [...s.lines, { ...emptyLine }] }));
  const delLine = (i) => setInv((s) => ({ ...s, lines: s.lines.filter((_, idx) => idx !== i) }));

  const subtotal = inv.lines.reduce((a, l) => a + (l.amount || 0), 0);
  const gst = +(subtotal * inv.gst_percent / 100).toFixed(2);
  const total = +(subtotal + gst).toFixed(2);

  const save = async () => {
    if (!inv.invoice_number || !inv.supplier_id || !inv.site_id || inv.lines.length === 0)
      return toast.error("Fill invoice no., supplier, site and at least one line");
    if (inv.lines.some((l) => !l.item_id || l.quantity <= 0))
      return toast.error("Each line needs an item and quantity > 0");
    try {
      await api.post("/invoices", inv);
      toast.success("Invoice saved & stock updated");
      setOpen(false);
      setInv((s) => ({ ...s, invoice_number: "", lines: [{ ...emptyLine }], notes: "" }));
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete invoice & its inward movements?")) return;
    await api.delete(`/invoices/${id}`); load();
  };

  const exportCsv = () => {
    const t = localStorage.getItem("bt_token");
    const url = `${API}/export/invoices${siteId ? `?site_id=${siteId}` : ""}`;
    window.open(`${url}${url.includes("?") ? "&" : "?"}token=${t || ""}`, "_self");
  };

  const setSupplier = (id) => {
    const s = suppliers.find((x) => x.id === id);
    setInv({ ...inv, supplier_id: id, supplier_name: s?.name || "" });
  };

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">Procurement</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Purchase Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">Creating an invoice auto-records inward stock.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportCsv} className="rounded-sm" data-testid="export-invoices-button">
            <DownloadSimple size={14} className="mr-2" /> Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-invoice-button">
                <Plus size={14} className="mr-2" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm max-w-4xl">
              <DialogHeader><DialogTitle>New purchase invoice</DialogTitle></DialogHeader>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Invoice #</Label><Input data-testid="invoice-number-input" value={inv.invoice_number} onChange={(e) => setInv({ ...inv, invoice_number: e.target.value })} /></div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={inv.invoice_date} onChange={(e) => setInv({ ...inv, invoice_date: e.target.value })} />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Select value={inv.supplier_id} onValueChange={setSupplier}>
                    <SelectTrigger data-testid="invoice-supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Site</Label>
                  <Select value={inv.site_id} onValueChange={(v) => setInv({ ...inv, site_id: v })}
                    disabled={user?.role !== "admin"}>
                    <SelectTrigger data-testid="invoice-site-select"><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`invoice-site-option-${s.id}`}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border border-zinc-200 rounded-sm mt-2">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      <th className="text-left p-2">Item</th>
                      <th className="text-left p-2 w-20">Unit</th>
                      <th className="text-right p-2 w-24">Qty</th>
                      <th className="text-right p-2 w-28">Rate</th>
                      <th className="text-right p-2 w-28">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="p-1">
                          <Select value={l.item_id} onValueChange={(v) => pickItem(i, v)}>
                            <SelectTrigger data-testid={`invoice-line-item-${i}`} className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent>
                              {items.map((it) => (
                                <SelectItem key={it.id} value={it.id} data-testid={`invoice-line-item-${i}-option-${it.id}`}>{it.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1"><Input value={l.unit} disabled className="h-9" /></td>
                        <td className="p-1"><Input type="number" value={l.quantity} data-testid={`invoice-line-qty-${i}`} onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value || 0) })} className="h-9 text-right" /></td>
                        <td className="p-1"><Input type="number" value={l.rate} onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value || 0) })} className="h-9 text-right" /></td>
                        <td className="p-2 text-right bt-num">₹{inr(l.amount)}</td>
                        <td className="p-1 text-center"><button onClick={() => delLine(i)} className="text-zinc-400 hover:text-red-600"><Trash size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 border-t border-zinc-200 flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={addLine} className="rounded-sm" data-testid="add-invoice-line-button">+ Add line</Button>
                  <div className="text-sm space-y-1 text-right">
                    <div>Subtotal: <span className="bt-num font-semibold">₹{inr(subtotal)}</span></div>
                    <div className="flex items-center gap-2 justify-end">
                      GST %: <Input type="number" className="w-20 h-8" value={inv.gst_percent} onChange={(e) => setInv({ ...inv, gst_percent: parseFloat(e.target.value || 0) })} />
                      <span className="bt-num">₹{inr(gst)}</span>
                    </div>
                    <div className="text-lg font-display font-bold">Total: <span className="bt-num">₹{inr(total)}</span></div>
                  </div>
                </div>
              </div>

              <DialogFooter><Button onClick={save} data-testid="save-invoice-button" className="bg-blue-600 hover:bg-blue-700">Save Invoice</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="bt-card">
        <table className="bt-table w-full">
          <thead>
            <tr>
              <th>Invoice #</th><th>Date</th><th>Supplier</th><th>Site</th>
              <th className="text-right">Subtotal</th><th className="text-right">GST</th>
              <th className="text-right">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((iv) => {
              const site = sites.find((s) => s.id === iv.site_id);
              return (
                <tr key={iv.id} data-testid={`invoice-row-${iv.id}`}>
                  <td className="font-mono text-sm">{iv.invoice_number}</td>
                  <td>{iv.invoice_date}</td>
                  <td>{iv.supplier_name}</td>
                  <td className="text-zinc-500">{site?.name || "—"}</td>
                  <td className="text-right bt-num">₹{inr(iv.subtotal)}</td>
                  <td className="text-right bt-num">₹{inr(iv.gst_amount)}</td>
                  <td className="text-right bt-num font-semibold">₹{inr(iv.total)}</td>
                  <td className="text-right">{user?.role === "admin" && <button onClick={() => del(iv.id)} className="text-zinc-500 hover:text-red-600"><Trash size={16} /></button>}</td>
                </tr>
              );
            })}
            {invoices.length === 0 && <tr><td colSpan={8} className="text-center text-zinc-500 py-10">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
;
}
