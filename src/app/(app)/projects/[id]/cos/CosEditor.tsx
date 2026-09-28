"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { Card, Field, PageHeader, inputCls, btn, formatCurrency } from "@/components/ui";
import { toast } from "@/components/toast";
import { changeOrderTotals } from "@/lib/contracts";

const UNITS = ["Sq.ft", "R.ft", "Nos", "Set", "Lot", "Lump Sum"];
type Item = { deduction: boolean; category: string; name: string; description: string; quantity: string; unit: string; rate: string; gstPct: string };
export type CosDraft = { id?: string; title: string; reason: string; quotationId: string; timeImpactDays: string; items: Item[] };

const blank = (deduction = false): Item => ({ deduction, category: "", name: "", description: "", quantity: "1", unit: "Nos", rate: "", gstPct: "18" });
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function CosEditor({ projectId, projectLabel, quotes, initial }: { projectId: string; projectLabel: string; quotes: { id: string; label: string }[]; initial: CosDraft }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [items, setItems] = useState<Item[]>(initial.items.length ? initial.items : [blank()]);
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;
  const t = useMemo(() => changeOrderTotals(items.map((i) => ({ deduction: i.deduction, quantity: num(i.quantity), rate: num(i.rate), gstPct: num(i.gstPct) }))), [items]);
  const upd = (idx: number, k: keyof Item, v: string | boolean) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  const set = (k: keyof CosDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.title.trim()) return toast("Give the change a title.", "error");
    if (items.some((i) => !i.name.trim() || i.rate.trim() === "" || num(i.quantity) <= 0)) return toast("Every line needs a name, quantity and rate.", "error");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/changeorders/${initial.id}` : "/api/changeorders", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: f.title, reason: f.reason, quotationId: f.quotationId || null, timeImpactDays: Math.round(num(f.timeImpactDays)),
          items: items.map((i) => ({ deduction: i.deduction, category: i.category.trim() || "General", name: i.name.trim(), description: i.description.trim() || null, quantity: num(i.quantity), unit: i.unit, rate: num(i.rate), gstPct: num(i.gstPct) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      toast(editing ? "Change of scope updated." : `${data.changeOrder.cosNumber} created as draft.`);
      router.push(`/projects/${projectId}/cos/${editing ? initial.id : data.changeOrder.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={`/projects/${projectId}`} title={editing ? "Edit change of scope" : "New change of scope"} subtitle={projectLabel} />

      <Card title="Change details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title *" className="md:col-span-2"><input className={inputCls} value={f.title} onChange={set("title")} placeholder="e.g. Add study unit, remove false ceiling in bedroom 2" /></Field>
          <Field label="Reason / client request" className="md:col-span-2"><textarea rows={2} className={inputCls + " resize-none"} value={f.reason} onChange={set("reason")} /></Field>
          <Field label="Against quotation">
            <select className={inputCls} value={f.quotationId} onChange={set("quotationId")}>
              <option value="">— None —</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </select>
          </Field>
          <Field label="Timeline impact (days)" hint="Positive extends the completion date, negative shortens it.">
            <input type="number" step={1} className={inputCls} value={f.timeImpactDays} onChange={set("timeImpactDays")} />
          </Field>
        </div>
      </Card>

      <Card
        title="Additions & deductions"
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => setItems((xs) => [...xs, blank(false)])} className={btn.ghost}><Plus size={14} /> Addition</button>
            <button type="button" onClick={() => setItems((xs) => [...xs, blank(true)])} className={btn.ghost + " text-danger"}><Minus size={14} /> Deduction</button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {items.map((it, idx) => (
            <div key={idx} className={`rounded-xl2 border p-3 ${it.deduction ? "border-danger/25 bg-danger-bg/40" : "border-success/25 bg-success-bg/40"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-lg bg-white p-0.5 ring-1 ring-line">
                  <button type="button" onClick={() => upd(idx, "deduction", false)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${!it.deduction ? "bg-success text-white" : "text-ink-soft"}`}>+ Add</button>
                  <button type="button" onClick={() => upd(idx, "deduction", true)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${it.deduction ? "bg-danger text-white" : "text-ink-soft"}`}>− Deduct</button>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`mr-1 text-[13px] font-bold ${it.deduction ? "text-danger" : "text-success"}`}>{it.deduction ? "− " : "+ "}{formatCurrency(num(it.quantity) * num(it.rate))}</span>
                  {items.length > 1 && <button type="button" aria-label="Remove line" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} className="rounded-md p-1.5 text-danger hover:bg-white"><Trash2 size={14} /></button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
                <Field label="Room / category" className="md:col-span-3"><input className={inputCls} value={it.category} onChange={(e) => upd(idx, "category", e.target.value)} placeholder="e.g. Study" /></Field>
                <Field label="Item *" className="md:col-span-4"><input className={inputCls} value={it.name} onChange={(e) => upd(idx, "name", e.target.value)} /></Field>
                <Field label="Specification" className="col-span-2 md:col-span-5"><input className={inputCls} value={it.description} onChange={(e) => upd(idx, "description", e.target.value)} /></Field>
                <Field label="Qty *" className="md:col-span-2"><input type="number" min={0} step="any" className={inputCls} value={it.quantity} onChange={(e) => upd(idx, "quantity", e.target.value)} /></Field>
                <Field label="Unit" className="md:col-span-2"><select className={inputCls} value={it.unit} onChange={(e) => upd(idx, "unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
                <Field label="Rate (₹) *" className="md:col-span-5"><input type="number" min={0} step="any" className={inputCls} value={it.rate} onChange={(e) => upd(idx, "rate", e.target.value)} /></Field>
                <Field label="GST %" className="md:col-span-3"><select className={inputCls} value={it.gstPct} onChange={(e) => upd(idx, "gstPct", e.target.value)}>{["0", "5", "12", "18", "28"].map((g) => <option key={g} value={g}>{g}%</option>)}</select></Field>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Summary">
        <div className="ml-auto max-w-[340px] space-y-1.5 text-[13.5px]">
          <div className="flex justify-between text-ink-soft"><span>Additions (excl. GST)</span><span className="font-medium text-success">+ {formatCurrency(t.addTaxable)}</span></div>
          <div className="flex justify-between text-ink-soft"><span>Deductions (excl. GST)</span><span className="font-medium text-danger">− {formatCurrency(t.dedTaxable)}</span></div>
          <div className="flex justify-between text-ink-soft"><span>Net GST</span><span className="font-medium text-ink">{t.netGst < 0 ? "− " : ""}{formatCurrency(Math.abs(t.netGst))}</span></div>
          <div className={`flex justify-between border-t border-line pt-2 text-[16px] font-bold ${t.net < 0 ? "text-danger" : "text-primary"}`}>
            <span>{t.net < 0 ? "Net credit to client" : "Net additional amount"}</span><span>{formatCurrency(Math.abs(t.net))}</span>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-[-50px] z-30 -mx-4 rounded-t-xl2 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(37,26,81,0.06)] backdrop-blur md:bottom-[-40px] md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] text-ink-soft">{t.net < 0 ? "Net credit" : "Net change"} (incl. GST)</div>
            <div className={`text-[17px] font-bold ${t.net < 0 ? "text-danger" : "text-ink"}`}>{t.net < 0 ? "− " : "+ "}{formatCurrency(Math.abs(t.net))}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className={btn.secondary}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btn.primary + " px-5"}>{saving && <Loader2 size={15} className="animate-spin" />} {editing ? "Save changes" : "Save draft"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
