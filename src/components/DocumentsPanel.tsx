"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Image as ImageIcon, FileSpreadsheet, File, Download, Trash2, Loader2, Search, FolderOpen } from "lucide-react";
import { EmptyState, Field, inputCls, btn, formatDate } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";

export type DocRow = {
  id: string; fileName: string; category: string; mimeType: string; size: number; createdAt: string;
  uploadedBy: string; uploadedById: string; context: string | null;
};
export const DOC_CATEGORIES = ["Drawings", "3D Renders", "Site Photos", "Measurements", "Agreements", "Invoices & Bills", "Material Specs", "General"];

const iconFor = (m: string) => (m.startsWith("image/") ? ImageIcon : m === "application/pdf" ? FileText : /sheet|excel|csv/.test(m) ? FileSpreadsheet : File);
const sizeLabel = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DocumentsPanel({
  docs, canUpload, canDeleteAll, userId, target, targets,
}: {
  docs: DocRow[];
  canUpload: boolean;
  canDeleteAll: boolean;
  userId: string;
  /** Fixed attachment point, e.g. { projectId } on a project page. */
  target?: { projectId?: string; clientId?: string; leadId?: string };
  /** Choices when uploading from the Documents page. */
  targets?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return docs.filter((d) => (cat === "ALL" || d.category === cat) && (!n || d.fileName.toLowerCase().includes(n) || (d.context ?? "").toLowerCase().includes(n)));
  }, [docs, q, cat]);

  async function remove(d: DocRow) {
    if ((await ask({ title: `Delete ${d.fileName}?`, message: "The file will be removed for everyone.", danger: true, confirmLabel: "Delete" })) === null) return;
    setBusy(d.id);
    try {
      const res = await fetch(`/api/documents/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't delete.");
      toast("File deleted.");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl2 border border-line bg-white px-3 py-2 focus-within:border-primary/50">
          <Search size={15} className="text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="flex-1 bg-transparent text-[13.5px] outline-none" />
        </div>
        <div className="flex gap-2">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="flex-1 rounded-xl2 border border-line bg-white px-3 py-2 text-[13.5px] outline-none">
            <option value="ALL">All categories</option>
            {DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {canUpload && <button onClick={() => setUploading(true)} className={btn.primary}><Upload size={15} /> Upload</button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-line bg-white"><EmptyState icon={FolderOpen} title={docs.length ? "No matches" : "No files yet"} note={docs.length ? "Try another search or category." : "Upload drawings, renders, site photos and agreements."} /></div>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line bg-white">
          {filtered.map((d) => {
            const Icon = iconFor(d.mimeType);
            return (
              <div key={d.id} className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-line-soft"><Icon size={17} className="text-primary" /></div>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-ink hover:text-primary">{d.fileName}</div>
                  <div className="truncate text-[12px] text-ink-faint">{d.category} · {sizeLabel(d.size)} · {formatDate(d.createdAt)} · {d.uploadedBy}{d.context ? ` · ${d.context}` : ""}</div>
                </a>
                <a href={`/api/documents/${d.id}?dl=1`} aria-label="Download" className="rounded-lg p-2 text-ink-soft hover:bg-appbg hover:text-primary"><Download size={16} /></a>
                {(canDeleteAll || d.uploadedById === userId) && (
                  <button aria-label="Delete" disabled={busy === d.id} onClick={() => remove(d)} className="rounded-lg p-2 text-ink-faint hover:bg-danger-bg hover:text-danger">
                    {busy === d.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploading && <UploadModal target={target} targets={targets} onClose={() => setUploading(false)} onDone={() => { setUploading(false); router.refresh(); }} />}
    </div>
  );
}

function UploadModal({ target, targets, onClose, onDone }: { target?: { projectId?: string; clientId?: string; leadId?: string }; targets?: { value: string; label: string }[]; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("Drawings");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const tooBig = files.find((f) => f.size > 4 * 1024 * 1024);

  async function upload() {
    setBusy(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("category", category);
        const t = target ?? (link ? { [link.split(":")[0]]: link.split(":")[1] } : {});
        for (const [k, v] of Object.entries(t)) if (v) fd.set(k, v);
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Couldn't upload ${file.name}.`);
      }
      toast(files.length > 1 ? `${files.length} files uploaded.` : "File uploaded.");
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Upload files" footer={<button disabled={busy || !files.length || !!tooBig} onClick={upload} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Upload {files.length > 1 ? `${files.length} files` : ""}</button>}>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files)); }}
          className="flex flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-line bg-appbg px-4 py-8 text-center hover:border-primary/40"
        >
          <Upload size={22} className="text-primary" />
          <span className="text-[13.5px] font-semibold text-ink">{files.length ? files.map((f) => f.name).join(", ") : "Tap to choose files, or drop them here"}</span>
          <span className="text-[12px] text-ink-faint">Up to 4 MB each — images, PDFs, drawings, spreadsheets</span>
        </button>
        <input ref={ref} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        {tooBig && <div className="text-[12.5px] font-medium text-danger">{tooBig.name} is larger than 4 MB — please compress it first.</div>}
        <Field label="Category">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        {!target && targets && (
          <Field label="Attach to">
            <select className={inputCls} value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">— General (not linked) —</option>
              {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
