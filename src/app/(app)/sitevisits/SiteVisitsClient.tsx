"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Phone, User, CheckCircle2, Loader2, CalendarClock, Ruler, Trash2 } from "lucide-react";
import { EmptyState, Field, PageHeader, inputCls, btn, formatDateTime } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { toLocalInput } from "@/lib/labels";

type Visit = {
  id: string; scheduledAt: string; completedAt: string | null; title: string; href: string | null; kind: string;
  location: string | null; phone: string | null; assignee: string | null; assignedToId: string | null; notes: string | null; measurements: string | null;
};

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function SiteVisitsClient({
  visits, targets, users, canCreate, canEdit, preset,
}: { visits: Visit[]; targets: { value: string; label: string }[]; users: { id: string; name: string }[]; canCreate: boolean; canEdit: boolean; preset: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "done">("upcoming");
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "complete" | "edit"; visit: Visit } | null>(preset && canCreate ? { kind: "new" } : null);
  const shown = visits.filter((v) => (tab === "done" ? v.completedAt : !v.completedAt));
  if (tab === "done") shown.reverse();
  const refresh = () => { setModal(null); router.refresh(); };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Site visits"
        subtitle="Measurements and site checks for leads and running projects."
        actions={canCreate ? <button onClick={() => setModal({ kind: "new" })} className={btn.primary}><Plus size={15} /> Schedule visit</button> : undefined}
      />
      <div className="flex w-fit gap-1 rounded-[10px] bg-line-soft p-1">
        {([["upcoming", "Upcoming"], ["done", "Completed"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${tab === id ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>
            {label} <span className="opacity-60">{visits.filter((v) => (id === "done" ? v.completedAt : !v.completedAt)).length}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl2 border border-line bg-white"><EmptyState icon={MapPin} title={tab === "done" ? "No completed visits" : "No visits scheduled"} note="Schedule a visit to take measurements or check progress on site." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((v) => {
            const overdue = !v.completedAt && new Date(v.scheduledAt) < new Date();
            return (
              <div key={v.id} className={`rounded-xl2 border bg-white p-4 ${overdue ? "border-danger/25" : "border-line"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {v.href ? <Link href={v.href} className="truncate text-[15px] font-semibold text-ink hover:text-primary">{v.title}</Link> : <span className="text-[15px] font-semibold">{v.title}</span>}
                    <div className="text-[12px] text-ink-faint">{v.kind} visit</div>
                  </div>
                  {v.completedAt ? <span className="flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-bold text-success"><CheckCircle2 size={12} /> Done</span>
                    : <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overdue ? "bg-danger-bg text-danger" : "bg-[#EAF1FB] text-[#4A7FC9]"}`}>{overdue ? "Overdue" : "Scheduled"}</span>}
                </div>
                <div className="flex flex-col gap-1 text-[12.5px] text-ink-soft">
                  <span className="flex items-center gap-1.5"><CalendarClock size={13} /> {formatDateTime(v.scheduledAt)}</span>
                  {v.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(v.location)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary"><MapPin size={13} /> {v.location}</a>}
                  {v.phone && <a href={`tel:${v.phone}`} className="flex items-center gap-1.5 hover:text-primary"><Phone size={13} /> {v.phone}</a>}
                  <span className="flex items-center gap-1.5"><User size={13} /> {v.assignee ?? "Unassigned"}</span>
                </div>
                {v.notes && <div className="mt-2 rounded-lg bg-appbg p-2.5 text-[12.5px] text-ink-soft">{v.notes}</div>}
                {v.measurements && <div className="mt-2 flex gap-1.5 whitespace-pre-wrap rounded-lg bg-primary/5 p-2.5 text-[12.5px] text-ink"><Ruler size={13} className="mt-0.5 flex-shrink-0 text-primary" />{v.measurements}</div>}
                {canEdit && (
                  <div className="mt-3 flex gap-2 border-t border-line-soft pt-3">
                    {!v.completedAt && <button onClick={() => setModal({ kind: "complete", visit: v })} className={btn.success + " flex-1"}><CheckCircle2 size={15} /> Complete</button>}
                    <button onClick={() => setModal({ kind: "edit", visit: v })} className={btn.secondary + " flex-1"}>{v.completedAt ? "Edit notes" : "Reschedule"}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.kind === "new" && <ScheduleModal targets={targets} users={users} preset={preset} onClose={() => setModal(null)} onDone={refresh} />}
      {modal && modal.kind !== "new" && <VisitModal visit={modal.visit} mode={modal.kind} users={users} onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  );
}

function ScheduleModal({ targets, users, preset, onClose, onDone }: { targets: { value: string; label: string }[]; users: { id: string; name: string }[]; preset: string; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState(preset);
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86400000); d.setHours(11, 0, 0, 0); return toLocalInput(d); });
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const [k, id] = target.split(":");
      await call("/api/sitevisits", "POST", { [k]: id, scheduledAt: new Date(when).toISOString(), assignedToId: assignee || null, notes });
      toast("Site visit scheduled.");
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Schedule site visit" footer={<button disabled={busy || !target || !when} onClick={save} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Schedule</button>}>
      <div className="flex flex-col gap-3">
        <Field label="For *">
          <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— Choose lead or project —</option>
            {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="When *"><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Who's going">
          <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Me</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </Field>
        <Field label="Purpose / notes"><textarea rows={2} className={inputCls + " resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Full measurement of kitchen and living room" /></Field>
      </div>
    </Modal>
  );
}

function VisitModal({ visit, mode, users, onClose, onDone }: { visit: Visit; mode: "complete" | "edit"; users: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [when, setWhen] = useState(toLocalInput(new Date(visit.scheduledAt)));
  const [assignee, setAssignee] = useState(visit.assignedToId ?? "");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const [measurements, setMeasurements] = useState(visit.measurements ?? "");
  const [busy, setBusy] = useState(false);

  async function save(del = false) {
    setBusy(true);
    try {
      if (del) {
        if ((await ask({ title: "Remove this site visit?", danger: true, confirmLabel: "Remove" })) === null) return setBusy(false);
        await call(`/api/sitevisits/${visit.id}`, "DELETE");
      } else {
        await call(`/api/sitevisits/${visit.id}`, "PATCH", {
          action: mode === "complete" ? "complete" : "update",
          scheduledAt: mode === "edit" && !visit.completedAt ? new Date(when).toISOString() : undefined,
          assignedToId: assignee || null, notes, measurements,
        });
      }
      toast(del ? "Visit removed." : mode === "complete" ? "Visit marked complete." : "Visit updated.");
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open onClose={onClose} title={mode === "complete" ? "Complete site visit" : "Update site visit"}
      footer={
        <>
          {mode === "edit" && <button disabled={busy} onClick={() => save(true)} className={btn.danger}><Trash2 size={15} /></button>}
          <button disabled={busy} onClick={() => save()} className={(mode === "complete" ? btn.success : btn.primary) + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {mode === "complete" ? "Mark complete" : "Save"}</button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-[13.5px] font-semibold text-ink">{visit.title}</div>
        {mode === "edit" && !visit.completedAt && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="When"><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Who's going">
              <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </Field>
          </div>
        )}
        <Field label="Measurements" hint="One room per line, e.g. Kitchen: 10' x 8', ceiling 10'">
          <textarea rows={4} className={inputCls + " resize-y font-mono text-[13px]"} value={measurements} onChange={(e) => setMeasurements(e.target.value)} />
        </Field>
        <Field label="Observations / notes"><textarea rows={3} className={inputCls + " resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="text-[12px] text-ink-faint">Upload site photos from the Documents section (category “Site Photos”).</div>
      </div>
    </Modal>
  );
}
