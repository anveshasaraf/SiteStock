/**
 * Org Admin - super-admin area.
 * Manages sites, users, and memberships (grant/revoke site access).
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
  HardHat, Buildings, Users, ArrowLeft, Plus, Trash, ArrowRight, UserPlus,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const ROLES = [
  { value: "viewer",     label: "Viewer - read-only" },
  { value: "logger",     label: "Logger - log entries (field worker)" },
  { value: "manager",    label: "Manager - full CRUD" },
  { value: "site_admin", label: "Site Admin - manage members" },
];

const ROLE_BADGE = {
  site_admin: "bg-blue-100 text-blue-700",
  manager:    "bg-emerald-100 text-emerald-700",
  logger:     "bg-amber-100 text-amber-700",
  viewer:     "bg-zinc-100 text-zinc-600",
};

// ── Shell ────────────────────────────────────────────────────────────────────

export default function OrgAdmin() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
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
              className={({ isActive }) => `bt-link-row ${isActive ? "active" : ""}`}>
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

function Navigate({ to }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null;
}

// ── Sites ────────────────────────────────────────────────────────────────────

function SitesPage() {
  const navigate = useNavigate();
  const [sites,       setSites]       = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activeSite,  setActiveSite]  = useState(null);
  const [members,     setMembers]     = useState([]);
  const [grantForm,   setGrantForm]   = useState({ user_id: "", role: "logger" });
  const [form,        setForm]        = useState({ name: "", code: "", location: "" });

  const load = () => Promise.all([
    api.get("/org/sites"),
    api.get("/org/users"),
  ]).then(([s, u]) => { setSites(s.data); setAllUsers(u.data); }).catch(() => {});

  useEffect(() => { load(); }, []);

  const loadMembers = (site) => {
    setActiveSite(site);
    setMembersOpen(true);
    api.get(`/org/memberships/${site.id}`)
      .then((r) => setMembers(r.data))
      .catch(() => toast.error("Failed to load members"));
  };

  const save = async () => {
    if (!form.name) return toast.error("Site name required");
    try {
      await api.post("/org/sites", form);
      toast.success("Site created"); setNewSiteOpen(false); setForm({ name: "", code: "", location: "" }); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Archive this site? All data will be preserved.")) return;
    await api.delete(`/org/sites/${id}`); load();
  };

  const grantAccess = async () => {
    if (!grantForm.user_id) return toast.error("Select a user");
    try {
      await api.post("/org/memberships", {
        user_id: grantForm.user_id,
        site_id: activeSite.id,
        role: grantForm.role,
      });
      toast.success("Access granted");
      setGrantForm({ user_id: "", role: "logger" });
      const r = await api.get(`/org/memberships/${activeSite.id}`);
      setMembers(r.data);
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Failed"); }
  };

  const revoke = async (membershipId) => {
    if (!window.confirm("Remove this user's access?")) return;
    try {
      await api.delete(`/org/memberships/${membershipId}`);
      toast.success("Access removed");
      const r = await api.get(`/org/memberships/${activeSite.id}`);
      setMembers(r.data);
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Failed"); }
  };

  const changeRole = async (membershipId, newRole) => {
    const member = members.find((m) => m.id === membershipId);
    if (!member) return;
    try {
      await api.post("/org/memberships", {
        user_id: member.user_id,
        site_id: activeSite.id,
        role: newRole,
      });
      toast.success("Role updated");
      const r = await api.get(`/org/memberships/${activeSite.id}`);
      setMembers(r.data);
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Failed"); }
  };

  const nonMembers = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));

  return (
    <div className="px-6 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="bt-eyebrow">Organization</div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-0.5">Sites</h1>
        </div>
        <Dialog open={newSiteOpen} onOpenChange={setNewSiteOpen}>
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
            <div className="flex gap-2">
              <button
                onClick={() => loadMembers(s)}
                className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 border border-zinc-200 px-3 py-1.5 rounded-sm flex-1 justify-center transition-colors"
              >
                <UserPlus size={14} /> Manage Access
              </button>
              <button
                onClick={() => navigate(`/p/${s.id}`)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                Open <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
        {sites.length === 0 && (
          <div className="col-span-full text-center text-zinc-400 py-16">No sites yet.</div>
        )}
      </div>

      {/* Members dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle>Site Access - {activeSite?.name}</DialogTitle>
          </DialogHeader>

          {/* Current members */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {members.length === 0 && <p className="text-sm text-zinc-400 py-2">No members yet.</p>}
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-zinc-100 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="text-xs text-zinc-500">{m.email || m.phone}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-sm border-0 cursor-pointer ${ROLE_BADGE[m.role] || "bg-zinc-100"}`}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.value}</option>)}
                  </select>
                  <button onClick={() => revoke(m.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Grant access to existing user */}
          {nonMembers.length > 0 && (
            <div className="pt-4 border-t border-zinc-200 space-y-3">
              <div className="text-sm font-semibold text-zinc-700">Grant access to existing user</div>
              <div className="flex gap-2">
                <Select value={grantForm.user_id} onValueChange={(v) => setGrantForm({ ...grantForm, user_id: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select user…" /></SelectTrigger>
                  <SelectContent>
                    {nonMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email || u.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={grantForm.role} onValueChange={(v) => setGrantForm({ ...grantForm, role: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={grantAccess} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm">
                <UserPlus size={14} className="mr-2" /> Grant Access
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
          <p className="text-sm text-zinc-500 mt-1">
            Create users here, then grant them site access from the <strong>Sites</strong> page.
          </p>
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
                <Label>Email (for password login)</Label>
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
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
