/**
 * Org Admin — super-admin area.
 * Manages sites, users, memberships, and the aggregate rollup dashboard.
 */
import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { api, formatErr } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input }  from "../components/ui/input";
import { Label }  from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import {
  HardHat, Buildings, Users, ArrowLeft, Plus, Trash, ArrowRight,
} from "@phosphor-icons/react";
import { toast } from "sonner";

// ── Shell ────────────────────────────────────────────────────────────────────

export default function OrgAdmin() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Sidebar */}
      <aside className="md:w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-200 flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 text-white grid place-items-center rounded-sm">
            <HardHat size={16} weight="fill" />
          </div>
          <div>
            <div className="font-display font-bold text-sm">BuildTrack</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Org Admin</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { to: "/org/sites", label: "Sites",   Icon: Buildings },
            { to: "/org/users", label: "Users",   Icon: Users },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `bt-link-row ${isActive ? "active" : ""}`}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 px-2 py-2"
          >
            <ArrowLeft size={14} /> Back to projects
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <Routes>
          <Route index element={<Navigate to="sites" />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="users" element={<UsersPage />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Redirect helper ──────────────────────────────────────────────────────────
function Navigate({ to }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null;
}

// ── Sites ────────────────────────────────────────────────────────────────────

function SitesPage() {
  const navigate = useNavigate();
  const [sites,  setSites]  = useState([]);
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({ name: "", code: "", location: "" });

  const load = () => api.get("/org/sites").then((r) => setSites(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Site name required");
    try {
      await api.post("/org/sites", form);
      toast.success("Site created"); setOpen(false); setForm({ name: "", code: "", location: "" }); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Archive this site? All data will be preserved.")) return;
    await api.delete(`/org/sites/${id}`); load();
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="bt-eyebrow">Organization</div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-0.5">Sites</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-sm">
              <Plus size={16} className="mr-2" /> New Site
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>New site / project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code} placeholder="e.g. SITE-01" onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} placeholder="City, State" onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-blue-600 hover:bg-blue-700">Create Site</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((s) => (
          <div key={s.id} className="bt-card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{s.name}</div>
                {s.location && <div className="text-sm text-zinc-500">{s.location}</div>}
                {s.code && <div className="font-mono text-xs text-zinc-400 mt-0.5">{s.code}</div>}
              </div>
              <button onClick={() => del(s.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                <Trash size={16} />
              </button>
            </div>
            <button
              onClick={() => navigate(`/p/${s.id}`)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-semibold"
            >
              Open workspace <ArrowRight size={14} />
            </button>
          </div>
        ))}
        {sites.length === 0 && (
          <div className="col-span-full text-center text-zinc-400 py-16">No sites yet.</div>
        )}
      </div>
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────────────────

function UsersPage() {
  const [users,  setUsers]  = useState([]);
  const [sites,  setSites]  = useState([]);
  const [open,   setOpen]   = useState(false);
  const [form,   setForm]   = useState({
    name: "", email: "", phone: "", role: "logger", site_id: "", is_super_admin: false,
  });

  const load = () => Promise.all([
    api.get("/org/users"),
    api.get("/org/sites"),
  ]).then(([u, s]) => { setUsers(u.data); setSites(s.data); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    if (!form.email && !form.phone) return toast.error("Email or phone required");
    if (!form.site_id) return toast.error("Select an initial project");
    try {
      await api.post("/org/users", form);
      toast.success("User created"); setOpen(false);
      setForm({ name: "", email: "", phone: "", role: "logger", site_id: "", is_super_admin: false });
      load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    await api.delete(`/org/users/${id}`); load();
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="bt-eyebrow">Organization</div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-0.5">Users</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-sm">
              <Plus size={16} className="mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader><DialogTitle>Provision new user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Phone (for OTP login)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">+91</span>
                  <Input className="pl-10" value={form.phone} placeholder="9876543210"
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
                </div>
              </div>
              <div>
                <Label>Email (for password login — managers/admins)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Initial Project</Label>
                <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role in project</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer — read-only</SelectItem>
                    <SelectItem value="logger">Logger — log entries (field worker)</SelectItem>
                    <SelectItem value="manager">Manager — full CRUD</SelectItem>
                    <SelectItem value="site_admin">Site Admin — manage members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-blue-600 hover:bg-blue-700">Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="bt-card overflow-x-auto">
        <table className="bt-table w-full">
          <thead>
            <tr><th>Name</th><th>Contact</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-zinc-500 text-sm">{u.email || u.phone}</td>
                <td className="text-xs text-zinc-400">{u.created_at?.slice(0, 10)}</td>
                <td>
                  <button onClick={() => del(u.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="text-center text-zinc-400 py-10">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
