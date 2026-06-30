import React, { useContext } from "react";
import { downloadFile } from "../lib/auth";
import { SiteContext } from "./Layout";
import { Button } from "../components/ui/button";
import { DownloadSimple, FileXls, FileCsv, Package, Receipt, ArrowsLeftRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Reports() {
  const { siteId } = useContext(SiteContext);
  const q = siteId ? `?site_id=${siteId}` : "";
  const movQ = (type) => `${q}${q ? "&" : "?"}type=${type}`;

  const dl = async (path, filename) => {
    try { await downloadFile(path, filename); toast.success(`${filename} downloaded`); }
    catch (e) { toast.error(e.message || "Download failed"); }
  };

  const reports = [
    { title: "Stock Register", desc: "Color-coded LOW / OUT / HIGH rows, with status, value and thresholds.",
      csv: `/export/stock${q}`, xlsx: `/export/stock.xlsx${q}`, file: "stock_register", icon: Package, testid: "report-stock" },
    { title: "Invoices", desc: "Line-item level purchase invoice export with GST and totals.",
      csv: `/export/invoices${q}`, xlsx: `/export/invoices.xlsx${q}`, file: "invoices", icon: Receipt, testid: "report-invoices" },
    { title: "Inward Movements", desc: "All material received entries with rate and amount.",
      csv: `/export/movements${movQ("inward")}`, xlsx: `/export/movements.xlsx${movQ("inward")}`, file: "inward", icon: ArrowsLeftRight, testid: "report-inward" },
    { title: "Outward Movements", desc: "All issues from stock with destination and reference.",
      csv: `/export/movements${movQ("outward")}`, xlsx: `/export/movements.xlsx${movQ("outward")}`, file: "outward", icon: ArrowsLeftRight, testid: "report-outward" },
    { title: "Consumption", desc: "Material consumed on site / project.",
      csv: `/export/movements${movQ("consumption")}`, xlsx: `/export/movements.xlsx${movQ("consumption")}`, file: "consumption", icon: ArrowsLeftRight, testid: "report-consumption" },
  ];

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header>
        <div className="bt-eyebrow">Data</div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">Reports &amp; Export</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Download CSV or styled Excel files. XLSX includes frozen headers, column widths and color-coded stock status.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bt-card p-6 flex flex-col gap-3 hover:border-zinc-400 transition-colors" data-testid={r.testid}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm"><r.icon size={18} /></div>
              <div>
                <div className="bt-eyebrow">Excel / CSV</div>
                <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              </div>
            </div>
            <p className="text-sm text-zinc-500 flex-1">{r.desc}</p>
            <div className="flex gap-2 mt-auto">
              <Button onClick={() => dl(r.xlsx, `${r.file}.xlsx`)}
                className="rounded-sm bg-blue-600 hover:bg-blue-700 flex-1"
                data-testid={`${r.testid}-xlsx-button`}>
                <FileXls size={16} className="mr-2" /> Excel
              </Button>
              <Button onClick={() => dl(r.csv, `${r.file}.csv`)}
                variant="outline" className="rounded-sm flex-1"
                data-testid={`${r.testid}-button`}>
                <DownloadSimple size={14} className="mr-2" /> CSV
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bt-card p-6 flex items-center gap-3 text-sm text-zinc-500">
        <FileCsv size={20} />
        XLSX has frozen header rows, auto-filters and red/amber/blue row highlights for OUT/LOW/HIGH stock.
      </div>
    </div>
  );
}
