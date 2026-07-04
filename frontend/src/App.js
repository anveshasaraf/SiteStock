import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "sonner";

import Login        from "./pages/Login";
import ProjectSelect from "./pages/ProjectSelect";
import OrgAdmin     from "./pages/OrgAdmin";
import Layout       from "./pages/Layout";
import Dashboard    from "./pages/Dashboard";
import Stock        from "./pages/Stock";
import Invoices     from "./pages/Invoices";
import Movements    from "./pages/Movements";
import PhysicalStock from "./pages/PhysicalStock";
import Items        from "./pages/Items";
import Suppliers    from "./pages/Suppliers";
import Reports      from "./pages/Reports";
import LoggerHome   from "./pages/LoggerHome";

// ── Auth Guard ───────────────────────────────────────────────────────────────

function Guard({ children, superAdminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-zinc-400 text-sm tracking-widest uppercase animate-pulse">Loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (superAdminOnly && !user.is_super_admin) return <Navigate to="/projects" replace />;
  return children;
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Project selection — where you land after login */}
          <Route path="/projects" element={<Guard><ProjectSelect /></Guard>} />

          {/* Org admin — super-admin only */}
          <Route path="/org/*" element={<Guard superAdminOnly><OrgAdmin /></Guard>} />

          {/* Per-project workspace — all feature routes live under /p/:siteId */}
          <Route
            path="/p/:siteId"
            element={<Guard><Layout /></Guard>}
          >
            {/* Logger home is the default — stripped view for site staff */}
            <Route index element={<LoggerHome />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="stock"         element={<Stock />} />
            <Route path="invoices"      element={<Invoices />} />
            <Route path="inward"        element={<Movements mode="inward" />} />
            <Route path="outward"       element={<Movements mode="outward" />} />
            <Route path="consumption"   element={<Movements mode="consumption" />} />
            <Route path="physical-stock" element={<PhysicalStock />} />
            <Route path="items"         element={<Items />} />
            <Route path="suppliers"     element={<Suppliers />} />
            <Route path="reports"       element={<Reports />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
