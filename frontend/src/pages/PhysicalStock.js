import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatErr, API } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { ClipboardText, FloppyDisk, ArrowsClockwise, Camera, CheckCircle, Image as ImgIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

function fmt(n) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n || 0); }

export default function PhysicalStock() {
  const { siteId } = useParams();
  const [stock, setStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({});  // key -> string
  const [photos, setPhotos] = useState({});  // key -> { path, name }
  const [adjust, setAdjust] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [uploadingKey, setUploadingKey] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const fileRefs = useRef({});

  const load = async () => {
    if (!siteId) return;
    const [s, h] = await Promise.all([
      api.get(`/p/${siteId}/stock`),
      api.get(`/p/${siteId}/physical-stock`),
    ]);
    setStock(s.data); setHistory(h.data);
  };
  useEffect(() => { load(); }, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() =>
    stock.filter((r) => [r.item_name, r.site_name, r.category].join(" ").toLowerCase().includes(q.toLowerCase())),
    [stock, q]);

  const keyOf = (r) => `${r.site_id}|${r.item_id}`;

  const variance = (r) => {
    const v = counts[keyOf(r)];
    if (v === undefined || v === "") return null;
    return +(parseFloat(v) - r.stock).toFixed(3);
  };

  const onPickPhoto = (key) => async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingKey(key);
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((p) => ({ ...p, [key]: { path: data.path, name: data.name } }));
      toast.success("Photo attached");
    } catch (err) { toast.error(formatErr(err.response?.data?.detail) || "Upload failed"); }
    finally { setUploadingKey(null); if (fileRefs.current[key]) fileRefs.current[key].value = ""; }
  };

  const saveAll = async () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== "" && v !== undefined);
    if (entries.length === 0) return toast.error("Enter at least one physical count");
    setSaving(true);
    try {
      for (const [key, val] of entries) {
        const [, item_id] = key.split("|");
        const photo = photos[key];
        await api.post(`/p/${siteId}/physical-stock`, {
          item_id, counted_qty: parseFloat(val), adjust, notes: "",
          photo_path: photo?.path || "", photo_name: photo?.name || "",
        });
      }
      toast.success(`Saved ${entries.length} count${entries.length === 1 ? "" : "s"}${adjust ? " (system adjusted)" : ""}`);
      setCounts({}); setPhotos({}); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail) || "Save failed"); }
    finally { setSaving(false); }
  };

  const openPreview = async (storagePath) => {
    try {
      const { data } = await api.get(`/files/signed`, { params: { path: storagePath } });
      setPreviewBlob(data.url);
    } catch { toast.error("Could not load photo"); }
  };
  const closePreview = () => { setPreviewBlob(null); };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="bt-eyebrow">Audit</div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1">Physical Stock Count</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Record counts &amp; attach a photo of the stock pile as proof. Toggle "Auto-adjust" to reconcile system to your count.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item / site" className="rounded-sm sm:w-56" data-testid="physical-search" />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-2 border border-zinc-300 rounded-sm">
            <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} data-testid="physical-adjust-toggle" />
            Auto-adjust
          </label>
          <Button onClick={saveAll} disabled={saving} className="rounded-sm bg-blue-600 hover:bg-blue-700 h-11" data-testid="save-physical-button">
            <FloppyDisk size={16} className="mr-2" /> {saving ? "Saving…" : "Save Counts"}
          </Button>
        </div>
      </header>

      <div className="bt-card overflow-x-auto">
        <table className="bt-table w-full min-w-[860px]">
          <thead>
            <tr>
              <th>Item</th><th>Site</th><th>Unit</th>
              <th className="text-right">System Qty</th>
              <th className="text-right">Physical Qty</th>
              <th className="text-center">Photo</th>
              <th className="text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const k = keyOf(r);
              const v = variance(r);
              const photo = photos[k];
              return (
                <tr key={k} data-testid={`physical-row-${r.site_id}-${r.item_id}`}>
                  <td className="font-medium">{r.item_name}</td>
                  <td className="text-zinc-500">{r.site_name}</td>
                  <td>{r.unit}</td>
                  <td className="text-right bt-num">{fmt(r.stock)}</td>
                  <td className="text-right">
                    <Input type="number" value={counts[k] ?? ""}
                      onChange={(e) => setCounts({ ...counts, [k]: e.target.value })}
                      className="h-9 text-right w-32 inline-block"
                      data-testid={`physical-input-${r.item_id}`}
                      placeholder="-" />
                  </td>
                  <td className="text-center">
                    <input
                      ref={(el) => { fileRefs.current[k] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={onPickPhoto(k)}
                      data-testid={`physical-photo-input-${r.item_id}`}
                    />
                    <button
                      type="button"
                      onClick={() => fileRefs.current[k]?.click()}
                      disabled={uploadingKey === k}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-sm transition-colors ${
                        photo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-300 hover:border-zinc-900"
                      }`}
                      data-testid={`physical-photo-btn-${r.item_id}`}
                    >
                      {uploadingKey === k ? "…" :
                        photo ? <><CheckCircle size={12} weight="fill" /> Attached</> :
                        <><Camera size={12} /> Photo</>}
                    </button>
                  </td>
                  <td className="text-right bt-num">
                    {v === null ? <span className="text-zinc-300">-</span> :
                      v === 0 ? <span className="bt-badge bt-status-ok">Match</span> :
                      v > 0 ? <span className="text-emerald-700">+{fmt(v)}</span> :
                      <span className="text-red-700">{fmt(v)}</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="text-center text-zinc-500 py-10">No stock to count.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardText size={18} />
          <h2 className="font-display text-xl font-semibold">Audit History</h2>
        </div>
        <div className="bt-card overflow-x-auto">
          <table className="bt-table w-full min-w-[800px]">
            <thead><tr><th>Date</th><th>Item</th><th className="text-right">System</th><th className="text-right">Counted</th><th className="text-right">Variance</th><th>By</th><th>Photo</th><th>Adjusted</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} data-testid={`audit-row-${h.id}`}>
                  <td className="text-xs text-zinc-500">{h.created_at?.slice(0, 16).replace("T", " ")}</td>
                  <td className="font-medium">{h.item_name}</td>
                  <td className="text-right bt-num">{fmt(h.system_qty)}</td>
                  <td className="text-right bt-num">{fmt(h.counted_qty)}</td>
                  <td className="text-right bt-num">
                    {h.variance === 0 ? <span className="text-zinc-500">0</span> :
                     h.variance > 0 ? <span className="text-emerald-700">+{fmt(h.variance)}</span> :
                     <span className="text-red-700">{fmt(h.variance)}</span>}
                  </td>
                  <td className="text-zinc-500">{h.counted_by_name || "-"}</td>
                  <td>
                    {h.photo_path ? (
                      <button onClick={() => openPreview(h.photo_path)} className="text-blue-600 inline-flex items-center gap-1" data-testid={`audit-photo-${h.id}`}>
                        <ImgIcon size={14} /> View
                      </button>
                    ) : <span className="text-zinc-300">-</span>}
                  </td>
                  <td>{h.adjusted ? <span className="bt-badge bt-status-high"><ArrowsClockwise size={12} className="mr-1" /> Yes</span> : <span className="text-zinc-400">-</span>}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={8} className="text-center text-zinc-500 py-10">No audits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!previewBlob} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="rounded-sm max-w-3xl">
          <DialogHeader><DialogTitle>Stock-pile photo</DialogTitle></DialogHeader>
          {previewBlob && <img src={previewBlob} alt="stock pile" className="max-h-[70vh] w-auto mx-auto" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
