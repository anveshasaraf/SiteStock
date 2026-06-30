import React, { useEffect, useState } from "react";
import { api, formatErr } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const empty = { email: "", password: "", name: "", role: "site_user", site_id: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/users"), api.get("/sites")]);
    setUsers(a.data); setSites(b.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.email || !form.password || !form.name) return toast.error("Email, password, name required");
    if (form.role === "site_user" && !form.site_id) return toast.error("Site required for site user");
    try {
      const payload = { ...form, site_id: form.role === "admin" ? null : form.site_id };
      await api.post("/auth/register", payload);
      toast.success("User created");
      setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    await api.delete(`/users/${id}`); load();
  };

  return (
    <div className="px-8 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="bt-eyebrow">Admin</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Users &amp; Access</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-user-button">
              <Plus size={14} className="mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>New user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input data-testid="user-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input data-testid="user-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Password</Label><Input data-testid="user-password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (all sites)</SelectItem>
                    <SelectItem value="site_user">Site User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "site_user" && (
                <div>
                  <Label>Site</Label>
                  <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}>
                    <SelectTrigger data-testid="user-site-select"><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`user-site-option-${s.id}`}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={save} data-testid="save-user-button" className="bg-blue-600 hover:bg-blue-700">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="bt-card">
        <table className="bt-table w-full">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Site</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const site = sites.find((s) => s.id === u.site_id);
              return (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-zinc-500">{u.email}</td>
                  <td><span className={`bt-badge ${u.role === "admin" ? "bt-status-high" : "bt-status-ok"}`}>{u.role}</span></td>
                  <td className="text-zinc-500">{u.role === "admin" ? "All" : site?.name || "—"}</td>
                  <td className="text-right">{u.role !== "admin" && <button onClick={() => del(u.id)} className="text-zinc-500 hover:text-red-600"><Trash size={16} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
