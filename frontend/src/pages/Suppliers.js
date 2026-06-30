import React, { useEffect, useState } from "react";
import { api, formatErr } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, Pencil, Trash } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";

const empty = { name: "", contact: "", phone: "", address: "" };

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => { const { data } = await api.get("/suppliers"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.name) return toast.error("Name required");
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post("/suppliers", form);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete supplier?")) return;
    await api.delete(`/suppliers/${id}`); load();
  };

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">Master Data</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Suppliers</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-supplier-button">
              <Plus size={14} className="mr-2" /> New Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>{editId ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input data-testid="supplier-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Contact person</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} data-testid="save-supplier-button" className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="bt-card">
        <table className="bt-table w-full">
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Address</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} data-testid={`supplier-row-${s.id}`}>
                <td className="font-medium">{s.name}</td>
                <td className="text-zinc-500">{s.contact}</td>
                <td>{s.phone}</td>
                <td className="text-zinc-500">{s.address}</td>
                <td className="text-right">
                  <button onClick={() => { setEditId(s.id); setForm({ name: s.name, contact: s.contact || "", phone: s.phone || "", address: s.address || "" }); setOpen(true); }} className="text-zinc-500 hover:text-zinc-900 mr-3"><Pencil size={16} /></button>
                  <button onClick={() => del(s.id)} className="text-zinc-500 hover:text-red-600"><Trash size={16} /></button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-500 py-10">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
