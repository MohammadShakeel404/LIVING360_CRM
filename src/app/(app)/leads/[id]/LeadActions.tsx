"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, FileText, UserCheck, Pencil, XCircle, Trash2, Loader2, Flame, Sun, Snowflake } from "lucide-react";
import { Card, Field, inputCls, btn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { ask } from "@/components/confirm";
import { LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_SOURCES, FOLLOWUP_TYPES, PROPERTY_TYPES, humanize, toLocalInput } from "@/lib/labels";

type Lead = {
  id: string; name: string; phone: string; whatsapp: string | null; email: string | null; stage: string; score: string;
  source: string; propertyType: string | null; propertySize: string | null; bedrooms: number | null;
  projectLocation: string | null; address: string | null; budgetMin: string | null; budgetMax: string | null;
  assignedToId: string | null; isClient: boolean;
};

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function LeadActions({
  lead, financial, team, canFollowUp, canQuote, canDelete,
}: {
  lead: Lead;
  financial: boolean;
  team: { id: string; name: string }[];
  canFollowUp: boolean;
  canQuote: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<"followup" | "edit" | "lost" | null>(null);
  const closed = lead.stage === "CONVERTED" || lead.stage === "LOST";

  async function run(key: string, fn: () => Promise<any>, ok?: string) {
    setBusy(key);
    try {
      const data = await fn();
      toast(data?.message ?? ok ?? "Saved.");
      setModal(null);
      router.refresh();
      return data;
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const patch = (body: object, ok: string) => run("patch", () => call(`/api/leads/${lead.id}`, "PATCH", body), ok);

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Pipeline stage">
            <select
              className={inputCls}
              value={lead.stage}
              disabled={busy !== null || lead.stage === "CONVERTED"}
              onChange={(e) => (e.target.value === "LOST" ? setModal("lost") : patch({ stage: e.target.value }, `Moved to ${LEAD_STAGE_LABEL[e.target.value]}.`))}
            >
              {LEAD_STAGES.filter((s) => s !== "CONVERTED" || lead.stage === "CONVERTED").map((s) => <option key={s} value={s}>{LEAD_STAGE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Lead score">
            <div className="flex gap-1 rounded-[10px] bg-line-soft p-1">
              {([["HOT", Flame, "text-danger"], ["WARM", Sun, "text-warning"], ["COLD", Snowflake, "text-[#4A7FC9]"]] as const).map(([s, Icon, cls]) => (
                <button
                  key={s} type="button" disabled={busy !== null}
                  onClick={() => s !== lead.score && patch({ score: s }, `Marked ${s.toLowerCase()}.`)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${lead.score === s ? `bg-white shadow-sm ${cls}` : "text-ink-soft"}`}
                >
                  <Icon size={13} /> {humanize(s)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          {canFollowUp && !closed && <button onClick={() => setModal("followup")} className={btn.primary}><CalendarPlus size={15} /> Log / schedule follow-up</button>}
          {canQuote && lead.stage !== "LOST" && <Link href={`/quotations/new?leadId=${lead.id}`} className={btn.secondary}><FileText size={15} /> Create quotation</Link>}
          {!lead.isClient && lead.stage !== "LOST" && (
            <button
              disabled={busy !== null}
              onClick={async () => (await ask({ title: `Convert ${lead.name} into a client?`, message: "Their quotations move to the new client record.", confirmLabel: "Convert" })) !== null && run("convert", () => call(`/api/leads/${lead.id}/convert`, "POST"))}
              className={btn.success}
            >
              {busy === "convert" ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />} Convert to client
            </button>
          )}
          <button onClick={() => setModal("edit")} className={btn.secondary}><Pencil size={15} /> Edit details</button>
          {!closed && <button onClick={() => setModal("lost")} className={btn.danger}><XCircle size={15} /> Mark lost</button>}
          {canDelete && (
            <button
              disabled={busy !== null}
              onClick={async () => {
                if ((await ask({ title: "Delete this lead permanently?", message: "This can't be undone.", danger: true, confirmLabel: "Delete" })) === null) return;
                const ok = await run("delete", () => call(`/api/leads/${lead.id}`, "DELETE"), "Lead deleted.");
                if (ok) router.push("/leads");
              }}
              className={btn.danger + " md:ml-auto"}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>

      {modal === "followup" && <FollowUpModal open onClose={() => setModal(null)} busy={busy === "fu"} onSave={(body) => run("fu", () => call(`/api/leads/${lead.id}/followups`, "POST", body), body.completed ? "Interaction logged." : "Follow-up scheduled.")} />}
      {modal === "lost" && <LostModal open onClose={() => setModal(null)} busy={busy === "patch"} onSave={(reason) => patch({ stage: "LOST", lostReason: reason }, "Lead marked as lost.")} />}
      {modal === "edit" && <EditModal open onClose={() => setModal(null)} lead={lead} financial={financial} team={team} busy={busy === "patch"} onSave={(body) => patch(body, "Lead updated.")} />}
    </Card>
  );
}

function FollowUpModal({ open, onClose, onSave, busy }: { open: boolean; onClose: () => void; onSave: (b: any) => void; busy: boolean }) {
  const [mode, setMode] = useState<"schedule" | "log">("schedule");
  const [type, setType] = useState("CALL");
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 86400000)));
  const [notes, setNotes] = useState("");
  return (
    <Modal
      open={open} onClose={onClose} title="Follow-up"
      footer={
        <button
          disabled={busy || !when}
          onClick={() => onSave({ type, notes, completed: mode === "log", scheduledAt: mode === "log" ? new Date().toISOString() : new Date(when).toISOString() })}
          className={btn.primary + " flex-1 py-3"}
        >
          {busy && <Loader2 size={15} className="animate-spin" />} {mode === "log" ? "Log interaction" : "Schedule"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-line-soft p-1">
          {([["schedule", "Schedule next"], ["log", "Log what happened"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} className={`rounded-lg py-1.5 text-[12.5px] font-semibold ${mode === id ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>{label}</button>
          ))}
        </div>
        <Field label="Type">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {FOLLOWUP_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </Field>
        {mode === "schedule" && (
          <Field label="When"><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        )}
        <Field label={mode === "log" ? "What was discussed?" : "Notes (optional)"}>
          <textarea rows={3} className={inputCls + " resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === "log" ? "Client wants a revised kitchen layout…" : "Agenda for the call"} />
        </Field>
      </div>
    </Modal>
  );
}

function LostModal({ open, onClose, onSave, busy }: { open: boolean; onClose: () => void; onSave: (r: string) => void; busy: boolean }) {
  const reasons = ["Budget mismatch", "Chose a competitor", "Project postponed", "Not reachable", "Only exploring"];
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open} onClose={onClose} title="Mark lead as lost"
      footer={<button disabled={busy || !reason.trim()} onClick={() => onSave(reason.trim())} className={btn.danger + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Mark as lost</button>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${reason === r ? "border-primary bg-primary/10 text-primary" : "border-line text-ink-soft"}`}>{r}</button>
          ))}
        </div>
        <Field label="Reason"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was this lead lost?" /></Field>
      </div>
    </Modal>
  );
}

function EditModal({ open, onClose, onSave, busy, lead, financial, team }: { open: boolean; onClose: () => void; onSave: (b: any) => void; busy: boolean; lead: Lead; financial: boolean; team: { id: string; name: string }[] }) {
  const [f, setF] = useState(() => ({
    name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp ?? "", email: lead.email ?? "", source: lead.source,
    propertyType: lead.propertyType ?? "", propertySize: lead.propertySize ?? "", projectLocation: lead.projectLocation ?? "",
    address: lead.address ?? "", budgetMin: lead.budgetMin ?? "", budgetMax: lead.budgetMax ?? "", assignedToId: lead.assignedToId ?? "",
  }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const emailOk = !f.email || /^\S+@\S+\.\S+$/.test(f.email);

  function submit() {
    const body: Record<string, unknown> = {
      name: f.name, phone: f.phone, whatsapp: f.whatsapp, email: f.email, source: f.source, propertyType: f.propertyType,
      propertySize: f.propertySize, projectLocation: f.projectLocation, address: f.address,
    };
    if (financial) {
      body.budgetMin = f.budgetMin ? Number(f.budgetMin) : null;
      body.budgetMax = f.budgetMax ? Number(f.budgetMax) : null;
    }
    if (team.length) body.assignedToId = f.assignedToId || null;
    onSave(body);
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Edit lead" wide
      footer={<button disabled={busy || !f.name.trim() || f.phone.trim().length < 6 || !emailOk} onClick={submit} className={btn.primary + " flex-1 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} Save changes</button>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Full name *"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Mobile *"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="WhatsApp (if different)"><input className={inputCls} value={f.whatsapp} onChange={set("whatsapp")} inputMode="tel" /></Field>
        <Field label="Email" hint={emailOk ? undefined : "Enter a valid email"}><input className={inputCls} value={f.email} onChange={set("email")} type="email" /></Field>
        <Field label="Source">
          <select className={inputCls} value={f.source} onChange={set("source")}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
        </Field>
        <Field label="Property type">
          <select className={inputCls} value={f.propertyType} onChange={set("propertyType")}>
            <option value="">—</option>
            {[...new Set([...PROPERTY_TYPES, ...(f.propertyType ? [f.propertyType] : [])])].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Carpet area"><input className={inputCls} value={f.propertySize} onChange={set("propertySize")} placeholder="e.g. 1450 sq.ft" /></Field>
        <Field label="Project location"><input className={inputCls} value={f.projectLocation} onChange={set("projectLocation")} /></Field>
        <Field label="Full address" className="md:col-span-2"><textarea rows={2} className={inputCls + " resize-none"} value={f.address} onChange={set("address")} /></Field>
        {financial && (
          <>
            <Field label="Budget min (₹)"><input type="number" min={0} className={inputCls} value={f.budgetMin} onChange={set("budgetMin")} /></Field>
            <Field label="Budget max (₹)"><input type="number" min={0} className={inputCls} value={f.budgetMax} onChange={set("budgetMax")} /></Field>
          </>
        )}
        {team.length > 0 && (
          <Field label="Assigned to" className="md:col-span-2">
            <select className={inputCls} value={f.assignedToId} onChange={set("assignedToId")}>
              <option value="">Unassigned</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
