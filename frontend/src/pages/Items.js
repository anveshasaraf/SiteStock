import React, { useEffect, useState } from "react";
import { api, formatErr } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Pencil, Trash, Tag } from "@phosphor-icons/react";
import { toast } from "sonner";

const empty = { name: "", category: "", unit: "nos", min_stock: 0, max_stock: 0, rate: 0, description: "" };

export default function Items() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newCat, setNewCat] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/items"), api.get("/categories")]);
    setItems(a.data); setCats(b.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.name || !form.category) return toast.error("Name and category required");
      if (editId) await api.put(`/items/${editId}`, form);
      else await api.post("/items", form);
      toast.success(editId ? "Item updated" : "Item added");
      setOpen(false); setForm(empty); setEditId(null);
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try { await api.delete(`/items/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const addCat = async () => {
    if (!newCat.trim()) return;
    try {
      const { data } = await api.post("/categories", { name: newCat.trim() });
      setCats((c) => [...c.filter((x) => x.id !== data.id), data]);
      setForm({ ...form, category: data.name });
      setNewCat(""); setCatOpen(false);
      toast.success("Category added");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const startEdit = (it) => {
    setEditId(it.id);
    setForm({
      name: it.name, category: it.category, unit: it.unit,
      min_stock: it.min_stock, max_stock: it.max_stock, rate: it.rate,
      description: it.description || "",
    });
    setOpen(true);
  };

  const filtered = items.filter((i) =>
    [i.name, i.category, i.unit].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="bt-eyebrow">Master Data</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Items</h1>
          <p className="text-sm text-zinc-500 mt-1">Every SKU, every threshold.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            data-testid="items-search-input"
            placeholder="Search items…"
            value={q} onChange={(e) => setQ(e.target.value)}
            className="w-64 rounded-sm"
          />
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="manage-categories-button" className="rounded-sm">
                <Tag size={14} className="mr-2" /> Categories
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle>Manage categories</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" />
                  <Button onClick={addCat} data-testid="add-category-button">Add</Button>
                </div>
                <ul className="max-h-64 overflow-y-auto border border-zinc-200 rounded-sm divide-y">
                  {cats.map((c) => (
                    <li key={c.id} className="px-3 py-2 text-sm flex justify-between">{c.name}</li>
                  ))}
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <Button data-testid="add-item-button" className="rounded-sm bg-blue-600 hover:bg-blue-700">
                <Plus size={14} className="mr-2" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm max-w-lg">
              <DialogHeader><DialogTitle>{editId ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input data-testid="item-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="item-category-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.name} data-testid={`item-category-option-${c.name}`}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input data-testid="item-unit-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bag, ton, m³, nos" />
                </div>
                <div>
                  <Label>Min stock</Label>
                  <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Max stock</Label>
                  <Input type="number" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: parseFloat(e.target.value || 0) })} />
                </div>
                <div className="col-span-2">
                  <Label>Standard rate (₹)</Label>
                  <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value || 0) })} />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={save} data-testid="save-item-button" className="bg-blue-600 hover:bg-blue-700">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="bt-card">
        <table className="bt-table w-full">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Unit</th>
              <th className="text-right">Min</th><th className="text-right">Max</th>
              <th className="text-right">Rate</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id} data-testid={`item-row-${it.id}`}>
                <td className="font-medium">{it.name}</td>
                <td className="text-zinc-500">{it.category}</td>
                <td>{it.unit}</td>
                <td className="text-right bt-num">{it.min_stock}</td>
                <td className="text-right bt-num">{it.max_stock}</td>
                <td className="text-right bt-num">₹{it.rate}</td>
                <td className="text-right">
                  <button onClick={() => startEdit(it)} className="text-zinc-500 hover:text-zinc-900 mr-3" data-testid={`edit-item-${it.id}`}><Pencil size={16} /></button>
                  <button onClick={() => del(it.id)} className="text-zinc-500 hover:text-red-600" data-testid={`delete-item-${it.id}`}><Trash size={16} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-zinc-500 py-10">No items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
