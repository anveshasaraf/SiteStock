import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, formatErr } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { HardHat, Buildings, ShieldCheck } from "@phosphor-icons/react";

const HERO =
  "https://images.unsplash.com/photo-1694521787162-5373b598945c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwY29uY3JldGV8ZW58MHx8fHwxNzgyODEwMzIwfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@buildtrack.com");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      {/* Hero panel */}
      <div className="relative hidden md:block bg-zinc-900">
        <img
          src={HERO}
          alt="construction site"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900/70 via-zinc-900/30 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white text-zinc-900 grid place-items-center rounded-sm">
              <HardHat size={22} weight="fill" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">BuildTrack</span>
          </div>
          <div className="space-y-4">
            <div className="bt-eyebrow text-zinc-300">Inventory · Procurement · Consumption</div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05]">
              Every brick, beam &amp; bag — accounted for.
            </h1>
            <p className="text-zinc-300 max-w-md">
              Track inward, outward, issues and live stock across every site. One source of truth for your projects.
            </p>
            <div className="flex items-center gap-6 pt-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2"><Buildings size={18} /> Multi-site</div>
              <div className="flex items-center gap-2"><ShieldCheck size={18} /> Role-based</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-md space-y-6" data-testid="login-form">
          <div>
            <div className="bt-eyebrow mb-2">Sign in</div>
            <h2 className="font-display text-3xl font-bold">Access your control room</h2>
            <p className="text-sm text-zinc-500 mt-2">
              Admin sees every site. Site users see only their own.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="email" className="font-semibold">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 rounded-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="font-semibold">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 rounded-sm"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            data-testid="login-submit-button"
            className="w-full rounded-sm bg-blue-600 hover:bg-blue-700 text-white h-11"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="text-xs text-zinc-500 border border-dashed border-zinc-200 p-3 rounded-sm">
            <span className="bt-eyebrow block mb-1">Default admin</span>
            admin@buildtrack.com / admin123
          </div>
        </form>
      </div>
    </div>
  );
}
