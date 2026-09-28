"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { Field, inputCls, btn, formatCurrency } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { RATE_TYPE_LABEL } from "@/lib/workers";

export type WorkerOption = { id: string; name: string; trade: string; workerNumber: string; defaultRate: number | null; defaultRateType: string | null };
type Stage = { id?: string; label: string; amount: string };
export type AssignmentFormValue = {
  id?: string; workerId: string; projectId: string; scope: string; rateType: string; rate: string; quantity: string; unit: string;
  agreedAmount: string; startDate: string; endDate: string; notes: string; stages: Stage[]; paid?: number;
};

const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const UNIT_OPTIONS = ["sq.ft", "r.ft", "nos", "sets", "points"];

/**
 * Engage a worker on a project: what they'll do, how they're paid (fixed / per day / per unit)
 * and an optional stage-wise payment plan that must add up to the payable amount.
 */
export function AssignmentForm({
  initial, workers, projects, onClose,
}: { initial: AssignmentFormValue; workers: WorkerOption[]; projects?: { id: string; label: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [staged, setStaged] = useState(initial.stages.length > 0);
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;
  const set = (k: keyof AssignmentFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const payable = f.rateType === "LUMP_SUM" ? num(f.agreedAmount) : num(f.rate) * num(f.quantity);
  const stageSum = f.stages.reduce((s, x) => s + num(x.amount), 0);
  const stageGap = Math.round((payable - stageSum) * 100) / 100;

  function pickWorker(id: string) {
    const w = workers.find((x) => x.id === id);
    setF((p) => ({
      ...p, workerId: id,
      ...(w?.defaultRate && !editing ? { rateType: w.defaultRateType ?? "DAILY", rate: String(w.defaultRate), unit: w.defaultRateType === "PER_UNIT" ? "sq.ft" : "days" } : {}),
    }));
  }
  const updStage = (i: number, k: keyof Stage, v: string) => setF((p) => ({ ...p, stages: p.stages.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));

  async function save() {
    if (!f.projectId) return toast("Choose a project.", "error");
    if (!f.workerId) return toast("Choose a worker.", "error");
    if (!f.scope.trim()) return toast("Describe the work.", "error");
    if (payable <= 0) return toast("Enter the rate and quantity, or the fixed amount.", "error");
    if (staged && (f.stages.some((s) => !s.label.trim() || num(s.amount) <= 0) || Math.abs(stageGap) > 1)) {
      return toast(Math.abs(stageGap) > 1 ? `Stages must add up to ${formatCurrency(payable)} (${stageGap > 0 ? formatCurrency(stageGap) + " left to allocate" : formatCurrency(-stageGap) + " too much"}).` : "Every stage needs a name and amount.", "error");
    }
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/workers/assignments/${initial.id}` : "/api/workers/assignments", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: f.projectId, workerId: f.workerId, scope: f.scope, rateType: f.rateType,
          rate: f.rateType === "LUMP_SUM" ? null : num(f.rate), quantity: f.rateType === "LUMP_SUM" ? null : num(f.quantity),
          unit: f.unit || null, agreedAmount: f.rateType === "LUMP_SUM" ? num(f.agreedAmount) : null,
          startDate: f.startDate || null, endDate: f.endDate || null, notes: f.notes,
          stages: staged ? f.stages.map((s) => ({ id: s.id, label: s.label.trim(), amount: num(s.amount) })) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      toast(data.message ?? "Saved.");
      onClose();
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open wide onClose={onClose} title={editing ? "Edit work & pay" : "Add worker to project"}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div><div className="text-[11.5px] text-ink-soft">Total payable</div><div className="text-[17px] font-bold text-primary">{formatCurrency(payable)}</div></div>
          <button disabled={busy} onClick={save} className={btn.primary + " px-6 py-3"}>{busy && <Loader2 size={15} className="animate-spin" />} {editing ? "Save" : "Add to project"}</button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          {projects && (
            <Field label="Project *" className="md:col-span-2">
              <select className={inputCls} value={f.projectId} onChange={set("projectId")} disabled={editing}>
                <option value="">— Select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
          )}
          <Field label="Worker *" className={projects ? "md:col-span-2" : "md:col-span-2"}>
            <select className={inputCls} value={f.workerId} onChange={(e) => pickWorker(e.target.value)} disabled={editing && (initial.paid ?? 0) > 0}>
              <option value="">— Select worker —</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.trade} ({w.workerNumber})</option>)}
            </select>
          </Field>
          <Field label="Work / scope *" className="md:col-span-2">
            <input className={inputCls} value={f.scope} onChange={set("scope")} placeholder="e.g. Kitchen & wardrobe carpentry, living room false ceiling" />
          </Field>
        </div>

        <div className="rounded-xl2 border border-line bg-appbg/60 p-3">
          <div className="mb-2 text-[13px] font-semibold text-ink">How will they be paid?</div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-[10px] bg-line-soft p-1">
            {Object.entries(RATE_TYPE_LABEL).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setF((p) => ({ ...p, rateType: k, unit: k === "DAILY" ? "days" : k === "PER_UNIT" ? (UNIT_OPTIONS.includes(p.unit) ? p.unit : "sq.ft") : p.unit }))}
                className={`rounded-lg px-2 py-1.5 text-[12px] font-semibold ${f.rateType === k ? "bg-white text-primary shadow-sm" : "text-ink-soft"}`}>
                {v.replace(" (sq.ft / r.ft / nos)", "")}
              </button>
            ))}
          </div>
          {f.rateType === "LUMP_SUM" ? (
            <Field label="Agreed amount for this work (₹) *"><input type="number" min={0} className={inputCls + " text-[16px] font-semibold"} value={f.agreedAmount} onChange={set("agreedAmount")} /></Field>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Field label={f.rateType === "DAILY" ? "Rate per day (₹) *" : "Rate per unit (₹) *"}><input type="number" min={0} step="any" className={inputCls} value={f.rate} onChange={set("rate")} /></Field>
              <Field label={f.rateType === "DAILY" ? "Days *" : "Quantity *"}><input type="number" min={0} step="any" className={inputCls} value={f.quantity} onChange={set("quantity")} /></Field>
              {f.rateType === "PER_UNIT" ? (
                <Field label="Unit"><select className={inputCls} value={f.unit} onChange={set("unit")}>{UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              ) : (
                <Field label="Total"><div className={inputCls + " bg-white font-semibold"}>{formatCurrency(payable)}</div></Field>
              )}
            </div>
          )}
          {f.rateType !== "LUMP_SUM" && (
            <div className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-soft"><Info size={13} className="mt-0.5 flex-shrink-0" /> Estimate the days / quantity now; edit it later if the work takes longer — the payable updates.</div>
          )}
        </div>

        <div className="rounded-xl2 border border-line p-3">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-ink">Pay in stages</div>
              <div className="text-[12px] text-ink-soft">Split the amount into milestones (e.g. advance, after frame work, after finishing).</div>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={staged} onChange={(e) => {
              setStaged(e.target.checked);
              if (e.target.checked && !f.stages.length) setF((p) => ({ ...p, stages: [{ label: "Advance", amount: String(Math.round(payable * 0.3)) }, { label: "On completion", amount: String(payable - Math.round(payable * 0.3)) }] }));
            }} />
          </label>
          {staged && (
            <div className="mt-3 flex flex-col gap-2">
              {f.stages.map((s, i) => (
                <div key={i} className="grid grid-cols-[18px_minmax(0,1fr)_36px] items-center gap-x-2 gap-y-1.5 border-b border-line-soft pb-2.5 md:border-0 md:pb-0 md:grid-cols-[18px_minmax(0,1fr)_140px_36px]">
                  <span className="w-5 text-right text-[12px] font-semibold text-ink-faint">{i + 1}.</span>
                  <input className={inputCls} value={s.label} onChange={(e) => updStage(i, "label", e.target.value)} placeholder="Stage name" aria-label={`Stage ${i + 1} name`} />
                  <input type="number" min={0} className={inputCls + " col-start-2 row-start-2 text-right md:col-start-3 md:row-start-1"} value={s.amount} onChange={(e) => updStage(i, "amount", e.target.value)} placeholder="Amount ₹" aria-label={`Stage ${i + 1} amount`} />
                  <button type="button" aria-label="Remove stage" disabled={f.stages.length === 1} onClick={() => setF((p) => ({ ...p, stages: p.stages.filter((_, j) => j !== i) }))} className="col-start-3 row-start-1 rounded-md p-2 text-ink-faint md:col-start-4 hover:bg-danger-bg hover:text-danger disabled:opacity-30"><Trash2 size={15} /></button>
                </div>
              ))}
              <div className="flex items-center justify-between pl-7">
                <button type="button" onClick={() => setF((p) => ({ ...p, stages: [...p.stages, { label: "", amount: String(Math.max(stageGap, 0)) }] }))} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"><Plus size={14} /> Add stage</button>
                <span className={`text-[12.5px] font-semibold ${Math.abs(stageGap) <= 1 ? "text-success" : "text-danger"}`}>
                  {Math.abs(stageGap) <= 1 ? "Stages match the total" : stageGap > 0 ? `${formatCurrency(stageGap)} left to allocate` : `${formatCurrency(-stageGap)} over the total`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Start date"><input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="Expected end"><input type="date" className={inputCls} value={f.endDate} onChange={set("endDate")} /></Field>
          <Field label="Notes" className="md:col-span-2"><input className={inputCls} value={f.notes} onChange={set("notes")} placeholder="Materials by us, tools by worker, etc." /></Field>
        </div>
      </div>
    </Modal>
  );
}
