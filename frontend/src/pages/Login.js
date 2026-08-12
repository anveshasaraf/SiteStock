import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input }  from "../components/ui/input";
import { Label }  from "../components/ui/label";
import { HardHat, LockKey } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { loginEmail } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password required"); return; }
    setLoading(true);
    try {
      await loginEmail(email, password);
      navigate("/projects");
    } catch (err) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 pb-10">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-zinc-900 text-white grid place-items-center rounded-sm">
          <HardHat size={28} weight="fill" />
        </div>
        <div className="text-center">
          <div className="font-display text-2xl font-bold tracking-tight">BuildTrack</div>
          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500 mt-1">Inventory OS</div>
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit} className="bt-card w-full max-w-sm p-6 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">Email</Label>
          <Input
            type="email"
            placeholder="you@company.com"
            className="h-11 rounded-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">Password</Label>
          <div className="relative">
            <LockKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="password"
              placeholder="••••••••"
              className="pl-9 h-11 rounded-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-sm text-base font-semibold"
        >
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-xs text-zinc-400 text-center">
        Contact your site manager to get an account
      </p>
    </div>
  );
}
