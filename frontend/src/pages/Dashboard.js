import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/auth";
import { Package, ArrowDown, ArrowUp, Fire, Warning, TrendUp, Buildings } from "@phosphor-icons/react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

function Stat({ label, value, icon: Icon, accent = "text-zinc-900", testid }) {
  return (
    <div className="bt-stat-card" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="bt-eyebrow">{label}</div>
        <Icon size={18} className="text-zinc-400" />
      </div>
      <div className={`font-display text-3xl font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function inr(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
}

export default function Dashboard() {
  const { siteId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/p/${siteId}/dashboard`).then((r) => setData(r.data)).catch(() => {});
  }, [siteId]);

  if (!data) return <div className="p-10 text-zinc-500">Loading dashboard…</div>;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="bt-eyebrow">Overview</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Control Room</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Live procurement, consumption &amp; stock health.
          </p>
        </div>
      </header>

      {/* Stats grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Purchase Value" value={"₹" + inr(data.total_purchase_value)} icon={ArrowDown} testid="stat-purchase" />
        <Stat label="Consumption Value" value={"₹" + inr(data.total_consumption_value)} icon={Fire} testid="stat-consumption" />
        <Stat label="Stock On Hand" value={"₹" + inr(data.total_stock_value)} icon={Package} testid="stat-stock" />
        <Stat label="Low / Out Items" value={data.low_stock_count} icon={Warning} accent="text-amber-600" testid="stat-low" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend */}
        <div className="bt-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bt-eyebrow">Last 30 Days</div>
              <h3 className="font-display text-xl font-semibold">Movement trend</h3>
            </div>
            <TrendUp size={20} className="text-zinc-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="inward" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outward" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="consumption" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By site */}
        <div className="bt-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bt-eyebrow">Per Site</div>
              <h3 className="font-display text-xl font-semibold">Stock value</h3>
            </div>
            <Buildings size={20} className="text-zinc-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_site}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="site_name" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                <Tooltip />
                <Bar dataKey="stock_value" fill="#2563eb" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low / High lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertList title="Low / Out of Stock" rows={data.low_stock} variant="low" testid="low-stock-list" />
        <AlertList title="High / Excess Stock" rows={data.high_stock} variant="high" testid="high-stock-list" />
      </div>
    </div>
  );
}

function AlertList({ title, rows, variant, testid }) {
  return (
    <div className="bt-card" data-testid={testid}>
      <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <span className="bt-eyebrow">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-sm text-zinc-500">All items healthy.</div>
      ) : (
        <table className="bt-table w-full">
          <thead>
            <tr>
              <th>Item</th>
              <th>Site</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Threshold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="font-medium">{r.item_name}</td>
                <td className="text-zinc-500">{r.category}</td>
                <td className="text-right bt-num">{r.stock} {r.unit}</td>
                <td className="text-right bt-num text-zinc-500">
                  {variant === "low" ? (r.min_stock || r.auto_min_stock) : r.max_stock}
                </td>
                <td>
                  <span className={`bt-badge ${
                    r.status === "OUT" ? "bt-status-out" :
                    r.status === "LOW" ? "bt-status-low" :
                    r.status === "HIGH" ? "bt-status-high" : "bt-status-ok"
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
