import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "./supabase";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// ── Axios instance - attaches Supabase access token as Bearer ────────────────

export const api = axios.create({ baseURL: API });

api.interceptors.request.use(async (cfg) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    cfg.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return cfg;
});

// On 401, try refreshing the session once
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retried) {
      err.config._retried = true;
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        err.config.headers.Authorization = `Bearer ${session.access_token}`;
        return api(err.config);
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth context ─────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // null = loading, false = not authed
  const [loading, setLoading] = useState(true);

  const loadProfile = async (session) => {
    if (!session) { setUser(false); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => loadProfile(session));

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_OUT") { setUser(false); setLoading(false); return; }
      if (session) loadProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Login via Email + Password (admins / managers) ──────────────────────
  const loginEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    await loadProfile(data.session);
    return data.session;
  };

  // ── Login via Phone OTP (field workers) ─────────────────────────────────
  const sendOtp = async (phone) => {
    // phone must be in E.164 format: +91XXXXXXXXXX
    const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) throw new Error(error.message);
    return normalized;
  };

  const verifyOtp = async (phone, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) throw new Error(error.message);
    await loadProfile(data.session);
    return data.session;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, loginEmail, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

// ── File download helper (authenticates via Bearer) ─────────────────────────

export async function downloadFile(path, filename = "download.csv") {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API}${path}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatErr(detail) {
  if (!detail) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ?? JSON.stringify(e))).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}
