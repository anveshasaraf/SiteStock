import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import Sites from "./pages/Sites";
import Suppliers from "./pages/Suppliers";
import Invoices from "./pages/Invoices";
import Movements from "./pages/Movements";
import Stock from "./pages/Stock";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import PhysicalStock from "./pages/PhysicalStock";

function Guarded({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Guarded>
                <Layout />
              </Guarded>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/items" element={<Items />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/inward" element={<Movements mode="inward" />} />
            <Route path="/outward" element={<Movements mode="outward" />} />
            <Route path="/consumption" element={<Movements mode="consumption" />} />
            <Route path="/sites" element={<Guarded adminOnly><Sites /></Guarded>} />
            <Route path="/users" element={<Guarded adminOnly><Users /></Guarded>} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/physical-stock" element={<PhysicalStock />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
