import React, { useContext } from "react";
import { API } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Button } from "../components/ui/button";
import { DownloadSimple, FileCsv, Package, Receipt, ArrowsLeftRight } from "@phosphor-icons/react";

function dl(path) {
  const t = localStorage.getItem("bt_token");
  const sep = path.includes("?") ? "&" : "?";
  window.open(`${API}${path}${sep}token=${t || ""}`, "_self");
}

export default function Reports() {
  const { siteId } = useContext(SiteContext);
  const q = siteId ? `?site_id=${siteId}` : "";

  const reports = [
    { title: "Stock Register", desc: "Full stock with status, value, thresholds.", path: `/export/stock${q}`, icon: Package, testid: "report-stock" },
    { title: "Invoices", desc: "Line-item level purchase invoice export.", path: `/export/invoices${q}`, icon: Receipt, testid: "report-invoices" },
    { title: "Inward Movements", desc: "All material received entries.", path: `/export/movements${q}${q ? "&" : "?"}type=inward`, icon: ArrowsLeftRight, testid: "report-inward" },
    { title: "Outward Movements", desc: "All issues from stock.", path: `/export/movements${q}${q ? "&" : "?"}type=outward`, icon: ArrowsLeftRight, testid: "report-outward" },
    { title: "Consumption", desc: "All consumption entries.", path: `/export/movements${q}${q ? "&" : "?"}type=consumption`, icon: ArrowsLeftRight, testid: "report-consumption" },
  ];

  return (
    <div className="px-8 py-8 space-y-6">
      <header>
        <div className="bt-eyebrow">Data</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Reports &amp; Export</h1>
        <p className="text-sm text-zinc-500 mt-1">Download CSV files (Excel-compatible). Filtered by selected site.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bt-card p-6 flex flex-col gap-3 hover:border-zinc-400 transition-colors" data-testid={r.testid}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm"><r.icon size={18} /></div>
              <div>
                <div className="bt-eyebrow">CSV / Excel</div>
                <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              </div>
            </div>
            <p className="text-sm text-zinc-500">{r.desc}</p>
            <Button onClick={() => dl(r.path)} className="rounded-sm bg-blue-600 hover:bg-blue-700 mt-auto" data-testid={`${r.testid}-button`}>
              <DownloadSimple size={14} className="mr-2" /> Download
            </Button>
          </div>
        ))}
      </div>

      <div className="bt-card p-6 flex items-center gap-3 text-sm text-zinc-500">
        <FileCsv size={20} />
        Files are UTF-8 CSV — open directly in Excel or Google Sheets.
      </div>
    </div>
  );
}
