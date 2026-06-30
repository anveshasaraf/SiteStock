import React, { useContext, useEffect, useState } from "react";
import { api, formatErr } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, Pencil, Trash, MapPin } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";

const empty = { name: "", location: "", code: "" };

export default function Sites() {
  const { refreshSites } = useContext(SiteContext);
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => { const { data } = await api.get("/sites"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.name) return toast.error("Name required");
      if (editId) await api.put(`/sites/${editId}`, form);
      else await api.post("/sites", form);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditId(null);
      load(); refreshSites && refreshSites();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete site?")) return;
    await api.delete(`/sites/${id}`); load(); refreshSites && refreshSites();
  };

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">Admin</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Sites &amp; Projects</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-site-button">
              <Plus size={14} className="mr-2" /> New Site
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>{editId ? "Edit site" : "New site"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input data-testid="site-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save} data-testid="save-site-button" className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((s) => (
          <div key={s.id} className="bt-card p-5" data-testid={`site-card-${s.id}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="bt-eyebrow">{s.code || "Site"}</div>
                <h3 className="font-display text-xl font-semibold mt-1">{s.name}</h3>
                {s.location && (
                  <div className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                    <MapPin size={14} /> {s.location}
                  </div>
                )}
              </div>
              <div className="flex gap-2 text-zinc-500">
                <button onClick={() => { setEditId(s.id); setForm({ name: s.name, location: s.location || "", code: s.code || "" }); setOpen(true); }}><Pencil size={16} /></button>
                <button onClick={() => del(s.id)} className="hover:text-red-600"><Trash size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-zinc-500">No sites yet. Add your first site.</div>}
      </div>
    </div>
  );
}
