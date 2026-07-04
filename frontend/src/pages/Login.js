import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input }  from "../components/ui/input";
import { Label }  from "../components/ui/label";
import { HardHat, Phone, Envelope, LockKey, ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";

const TAB = { PHONE: "phone", EMAIL: "email" };
const OTP_LEN = 6;

export default function Login() {
  const navigate = useNavigate();
  const { loginEmail, sendOtp, verifyOtp } = useAuth();

  const [tab,     setTab]     = useState(TAB.PHONE);
  const [loading, setLoading] = useState(false);

  // Phone OTP state
  const [phone,    setPhone]    = useState("");
  const [otp,      setOtp]      = useState("");
  const [sentTo,   setSentTo]   = useState(null);  // null = code not sent yet

  // Email/pw state
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const normalized = await sendOtp(phone);
      setSentTo(normalized);
      toast.success(`Code sent to ${normalized}`);
    } catch (err) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== OTP_LEN) {
      toast.error(`Enter the ${OTP_LEN}-digit code you received`);
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(sentTo, otp);
      navigate("/projects");
    } catch (err) {
      toast.error(err.message || "Incorrect code — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
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

  // ── Render ────────────────────────────────────────────────────────────────

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
      <div className="bt-card w-full max-w-sm p-6 space-y-5">

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-sm">
          {[
            { key: TAB.PHONE, label: "Phone OTP", Icon: Phone },
            { key: TAB.EMAIL, label: "Email",     Icon: Envelope },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSentTo(null); setOtp(""); }}
              className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-[2px] transition-colors ${
                tab === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Phone OTP ─────────────────────────────────────────────────── */}
        {tab === TAB.PHONE && (
          <>
            {!sentTo ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono select-none">
                      +91
                    </span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      className="pl-12 h-12 text-base rounded-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5">You'll receive a 6-digit SMS code</p>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-sm text-base font-semibold">
                  {loading ? "Sending…" : <><span>Send Code</span><ArrowRight size={16} className="ml-2" /></>}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">
                    6-Digit Code
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="——————"
                    maxLength={OTP_LEN}
                    className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-sm"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
                    autoFocus
                  />
                  <p className="text-xs text-zinc-400 mt-1.5">Sent to {sentTo}</p>
                </div>
                <Button type="submit" disabled={loading || otp.length !== OTP_LEN}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-sm text-base font-semibold">
                  {loading ? "Verifying…" : "Verify & Sign In"}
                </Button>
                <button type="button" onClick={() => { setSentTo(null); setOtp(""); }}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
                  <ArrowLeft size={12} /> Change number
                </button>
              </form>
            )}
          </>
        )}

        {/* ── Email + Password ───────────────────────────────────────────── */}
        {tab === TAB.EMAIL && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">Email</Label>
              <Input type="email" placeholder="you@company.com" className="h-11 rounded-sm"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 block">Password</Label>
              <div className="relative">
                <LockKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input type="password" placeholder="••••••••" className="pl-9 h-11 rounded-sm"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-sm text-base font-semibold">
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs text-zinc-400 text-center">
        Contact your site manager to get an account
      </p>
    </div>
  );
}
