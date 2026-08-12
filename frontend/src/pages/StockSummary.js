import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, downloadFile } from "../lib/auth";
import { Button } from "../components/ui/button";
import { FileXls, ChartBar } from "@phosphor-icons/react";
import { toast } from "sonner";

const PERIODS = [
  { label: "Last 7 days",  days: 7   },
  { label: "Last 30 days", days: 30  },
  { label: "Last 90 days", days: 90  },
  { label: "Last year",    days: 365 },
];

function fmt(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n || 0); }
function inr(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0); }

const STATUS_BADGE = {
  OUT:  "bt-badge bt-status-out",
  LOW:  "bt-badge bt-status-low",
  HIGH: "bt-badge bt-status-high",
  OK:   "bt-badge bt-status-ok",
};

export default function StockSummary() {
  const { siteId } = useParams();
  const [rows, setRows]   = useState([]);
  const [days, setDays]   = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    api.get(`/p/${siteId}/stock-summary`, { params: { days } })
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Failed to load summary"))
      .finally(() => setLoading(false));
  }, [siteId, days]);

  const exportXlsx = async () => {
    try {
      await downloadFile(`/p/${siteId}/export/stock.xlsx`, "stock_summary.xlsx");
      toast.success("Downloaded");
    } catch (e) { toast.error(e.message || "Download failed"); }
  };

  const totals = rows.reduce(
    (acc, r) => ({
      inward_qty:    acc.inward_qty    + r.inward_qty,
      inward_value:  acc.inward_value  + r.inward_value,
      outward_qty:   acc.outward_qty   + r.outward_qty,
      outward_value: acc.outward_value + r.outward_value,
      consumed_qty:  acc.consumed_qty  + r.consumed_qty,
      consumed_value:acc.consumed_value+ r.consumed_value,
      closing_value: acc.closing_value + r.closing_value,
    }),
    { inward_qty: 0, inward_value: 0, outward_qty: 0, outward_value: 0,
      consumed_qty: 0, consumed_value: 0, closing_value: 0 }
  );

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="bt-eyebrow">Report</div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <ChartBar size={28} weight="duotone" className="text-blue-600" />
            Stock Summary
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Period-filtered inward / outward / consumed and current closing balance.
          </p>
        </div>
        <Button onClick={exportXlsx} className="rounded-sm bg-blue-600 hover:bg-blue-700">
          <FileXls size={16} className="mr-2" /> Export Excel
        </Button>
      </header>

      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 text-sm rounded-sm border transition-colors ${
              days === p.days
                ? "bg-zinc-900 text-white border-zinc-900"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary table */}
      <div className="bt-card overflow-x-auto">
        <table className="bt-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th rowSpan={2} className="align-bottom">Item</th>
              <th rowSpan={2} className="align-bottom">Unit</th>
              <th colSpan={2} className="text-center border-l border-zinc-100">Inward</th>
              <th colSpan={2} className="text-center border-l border-zinc-100">Outward</th>
              <th colSpan={2} className="text-center border-l border-zinc-100">Consumed</th>
              <th colSpan={2} className="text-center border-l border-zinc-100">Closing Balance</th>
              <th rowSpan={2} className="align-bottom">Status</th>
            </tr>
            <tr>
              <th className="text-right border-l border-zinc-100">Qty</th>
              <th className="text-right">Value (₹)</th>
              <th className="text-right border-l border-zinc-100">Qty</th>
              <th className="text-right">Value (₹)</th>
              <th className="text-right border-l border-zinc-100">Qty</th>
              <th className="text-right">Value (₹)</th>
              <th className="text-right border-l border-zinc-100">Qty</th>
              <th className="text-right">Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="text-center text-zinc-400 py-10">Loading…</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.item_id}>
                <td className="font-medium">{r.item_name}</td>
                <td className="text-zinc-500">{r.unit}</td>
                <td className="text-right bt-num text-emerald-700 border-l border-zinc-100">{fmt(r.inward_qty)}</td>
                <td className="text-right bt-num text-emerald-700">{inr(r.inward_value)}</td>
                <td className="text-right bt-num text-blue-700 border-l border-zinc-100">{fmt(r.outward_qty)}</td>
                <td className="text-right bt-num text-blue-700">{inr(r.outward_value)}</td>
                <td className="text-right bt-num text-red-700 border-l border-zinc-100">{fmt(r.consumed_qty)}</td>
                <td className="text-right bt-num text-red-700">{inr(r.consumed_value)}</td>
                <td className="text-right bt-num font-semibold border-l border-zinc-100">{fmt(r.closing_qty)}</td>
                <td className="text-right bt-num font-semibold">{inr(r.closing_value)}</td>
                <td>
                  <span className={STATUS_BADGE[r.status] || STATUS_BADGE.OK}>{r.status}</span>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} className="text-center text-zinc-400 py-10">No data for this period.</td></tr>
            )}
            {/* Totals row */}
            {!loading && rows.length > 0 && (
              <tr className="font-semibold bg-zinc-50 border-t-2 border-zinc-200">
                <td className="font-bold">Total</td>
                <td></td>
                <td className="text-right bt-num text-emerald-700 border-l border-zinc-100">-</td>
                <td className="text-right bt-num text-emerald-700">{inr(totals.inward_value)}</td>
                <td className="text-right bt-num text-blue-700 border-l border-zinc-100">-</td>
                <td className="text-right bt-num text-blue-700">{inr(totals.outward_value)}</td>
                <td className="text-right bt-num text-red-700 border-l border-zinc-100">-</td>
                <td className="text-right bt-num text-red-700">{inr(totals.consumed_value)}</td>
                <td className="text-right bt-num border-l border-zinc-100">-</td>
                <td className="text-right bt-num">{inr(totals.closing_value)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
