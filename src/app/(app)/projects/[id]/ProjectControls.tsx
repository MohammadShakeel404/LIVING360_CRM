"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Loader2, Trash2 } from "lucide-react";
import { Field, inputCls, btn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { PROJECT_STAGES, humanize } from "@/lib/labels";

type P = { id: string; stage: string; projectManagerId: string | null; siteLocation: string | null; startDate: string; expectedCompletion: string; budget: string; value: string };

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function ProjectControls({ project, managers, financial, canDelete }: { project: P; managers: { id: string; name: string }[]; financial: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const idx = PROJECT_STAGES.indexOf(project.stage as any);
  const next = PROJECT_STAGES[idx + 1];

  async function update(body: object, msg: string) {
    setBusy(true);
    try {
      await call(`/api/projects/${project.id}`, "PATCH", body);
      toast(msg);
      setEditing(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
      {next && (
        <button disabled={busy} onClick={() => update({ stage: next }, `Moved to ${humanize(next)}.`)} className={btn.primary}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Move to {humanize(next)}
        </button>
      )}
      <select
        aria-label="Set stage"
        disabled={busy}
        value={project.stage}
        onChange={(e) => update({ stage: e.target.value }, `Stage set to ${humanize(e.target.value)}.`)}
        className="rounded-[10px] border border-line bg-white px-3 py-[8px] text-[13px] font-semibold text-ink outline-none"
      >
        {PROJECT_STAGES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
      </select>
      <button onClick={() => setEditing(true)} className={btn.secondary}><Pencil size={15} /> Edit details</button>
      {canDelete && (
        <button
          disabled={busy}
          onClick={async () => {
            if ((await ask({ title: "Delete this project?", message: "Its tasks, site visits and files are deleted too.", danger: true, confirmLabel: "Delete" })) === null) return;
            try { await call(`/api/projects/${project.id}`, "DELETE"); toast("Project deleted."); router.push("/projects"); router.refresh(); }
            catch (e: any) { toast(e.message, "error"); }
          }}
          className={btn.danger + " md:ml-auto"}
        >
          <Trash2 size={15} /> Delete
        </button>
      )}
      {editing && <EditModal project={project} managers={managers} financial={financial} busy={busy} onClose={() => setEditing(false)} onSave={(b) => update(b, "Project updated.")} />}
    </div>
  );
}

function EditModal({ project, managers, financial, busy, onClose, onSave }: { project: P; managers: { id: string; name: string }[]; financial: boolean; busy: boolean; onClose: () => void; onSave: (b: object) => void }) {
  const [f, setF] = useState({ ...project, projectManagerId: project.projectManagerId ?? "", siteLocation: project.siteLocation ?? "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Modal
      open onClose={onClose} title="Edit project"
      footer={
        <button
          disabled={busy}
          onClick={() => onSave({
            projectManagerId: f.projectManagerId || null, siteLocation: f.siteLocation, startDate: f.startDate || null, expectedCompletion: f.expectedCompletion || null,
            ...(financial ? { budget: f.budget ? Number(f.budget) : null, value: f.value ? Number(f.value) : null } : {}),
          })}
          className={btn.primary + " flex-1 py-3"}
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Save
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Project manager">
          <select className={inputCls} value={f.projectManagerId} onChange={set("projectManagerId")}><option value="">— None —</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Site location"><input className={inputCls} value={f.siteLocation} onChange={set("siteLocation")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="Target completion"><input type="date" className={inputCls} value={f.expectedCompletion} onChange={set("expectedCompletion")} /></Field>
          {financial && <Field label="Contract value (₹)"><input type="number" min={0} className={inputCls} value={f.value} onChange={set("value")} /></Field>}
          {financial && <Field label="Budget (₹)"><input type="number" min={0} className={inputCls} value={f.budget} onChange={set("budget")} /></Field>}
        </div>
      </div>
    </Modal>
  );
}
