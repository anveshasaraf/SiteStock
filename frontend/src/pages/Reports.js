import React from "react";
import { useParams } from "react-router-dom";
import { downloadFile } from "../lib/auth";
import { Button } from "../components/ui/button";
import { DownloadSimple, FileXls, FileCsv, Package, Receipt, ArrowsLeftRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Reports() {
  const { siteId } = useParams();
  const base = `/p/${siteId}`;

  const dl = async (path, filename) => {
    try { await downloadFile(path, filename); toast.success(`${filename} downloaded`); }
    catch (e) { toast.error(e.message || "Download failed"); }
  };

  const reports = [
    { title: "Stock Register", desc: "Color-coded LOW / OUT / HIGH rows with status, value and thresholds.",
      xlsx: `${base}/export/stock.xlsx`,     csv: `${base}/export/stock`,           file: "stock_register", icon: Package },
    { title: "Invoices",       desc: "Line-item purchase invoice export with GST and totals.",
      xlsx: `${base}/export/invoices.xlsx`,  csv: null,                             file: "invoices",       icon: Receipt },
    { title: "Inward",         desc: "All material received entries with rate and amount.",
      xlsx: `${base}/export/movements.xlsx?type=inward`,   csv: null, file: "inward",   icon: ArrowsLeftRight },
    { title: "Outward",        desc: "All stock issues with destination and reference.",
      xlsx: `${base}/export/movements.xlsx?type=outward`,  csv: null, file: "outward",  icon: ArrowsLeftRight },
    { title: "Consumption",    desc: "Material consumed on site / project.",
      xlsx: `${base}/export/movements.xlsx?type=consumption`, csv: null, file: "consumption", icon: ArrowsLeftRight },
  ];

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header>
        <div className="bt-eyebrow">Data</div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">Reports &amp; Export</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Download styled Excel files. Frozen headers, auto-filters, and color-coded stock status rows.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bt-card p-6 flex flex-col gap-3 hover:border-zinc-400 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                <r.icon size={18} />
              </div>
              <div>
                <div className="bt-eyebrow">Export</div>
                <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              </div>
            </div>
            <p className="text-sm text-zinc-500 flex-1">{r.desc}</p>
            <div className="flex gap-2 mt-auto">
              <Button onClick={() => dl(r.xlsx, `${r.file}.xlsx`)}
                className="rounded-sm bg-blue-600 hover:bg-blue-700 flex-1">
                <FileXls size={16} className="mr-2" /> Excel
              </Button>
              {r.csv && (
                <Button onClick={() => dl(r.csv, `${r.file}.csv`)}
                  variant="outline" className="rounded-sm flex-1">
                  <DownloadSimple size={14} className="mr-2" /> CSV
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bt-card p-5 flex items-center gap-3 text-sm text-zinc-500">
        <FileCsv size={20} />
        XLSX has frozen header rows, auto-filters, and red/amber/blue row highlights for OUT/LOW/HIGH stock.
      </div>
    </div>
  );
}
