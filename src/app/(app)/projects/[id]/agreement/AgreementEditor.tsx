"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, Field, PageHeader, inputCls, btn, formatCurrency } from "@/components/ui";
import { MilestoneEditor, fromDrafts, type MilestoneDraft } from "@/components/MilestoneEditor";
import { toast } from "@/components/toast";

type QuoteOpt = { id: string; label: string; total: number };
export type AgreementDraft = {
  id?: string; quotationId: string; agreementDate: string; startDate: string; completionDate: string;
  schedule: MilestoneDraft[]; terms: string; workOrderNotes: string; exclusions: string;
};

export function AgreementEditor({ projectId, projectLabel, quotes, initial }: { projectId: string; projectLabel: string; quotes: QuoteOpt[]; initial: AgreementDraft }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;
  const quote = quotes.find((q) => q.id === f.quotationId);
  const set = (k: keyof AgreementDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.quotationId) return toast("Choose the agreed quotation.", "error");
    if (f.schedule.some((m) => !m.label.trim())) return toast("Every milestone needs a description.", "error");
    const sum = f.schedule.reduce((s, m) => s + (Number(m.pct) || 0), 0);
    if (Math.abs(sum - 100) > 0.01) return toast("Payment milestones must add up to 100%.", "error");
    if (f.startDate && f.completionDate && f.completionDate < f.startDate) return toast("Completion date must be after the start date.", "error");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/agreements/${initial.id}` : "/api/agreements", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, quotationId: f.quotationId, agreementDate: f.agreementDate || null, startDate: f.startDate || null,
          completionDate: f.completionDate || null, paymentSchedule: fromDrafts(f.schedule), terms: f.terms, workOrderNotes: f.workOrderNotes, exclusions: f.exclusions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the agreement.");
      toast(editing ? "Agreement updated." : `Agreement ${data.agreement.agreementNumber} created.`);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={`/projects/${projectId}`} title={editing ? "Edit agreement" : "New agreement & work order"} subtitle={projectLabel} />

      <Card title="Agreed quotation" subtitle="The agreement's scope (Annexure A) and contract value come from this quotation.">
        {quotes.length === 0 ? (
          <div className="rounded-lg bg-warning-bg p-3 text-[13px] font-medium text-warning">This client has no accepted quotation yet. Mark a quotation as “Client accepted” first.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Quotation *">
              <select className={inputCls} value={f.quotationId} onChange={set("quotationId")}>
                <option value="">— Select —</option>
                {quotes.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
              </select>
            </Field>
            {quote && <div className="rounded-[10px] bg-primary/5 px-4 py-2.5 text-right"><div className="text-[11.5px] text-ink-soft">Contract value</div><div className="text-[17px] font-bold text-primary">{formatCurrency(quote.total)}</div></div>}
          </div>
        )}
      </Card>

      <Card title="Dates">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Agreement date"><input type="date" className={inputCls} value={f.agreementDate} onChange={set("agreementDate")} /></Field>
          <Field label="Work start date"><input type="date" className={inputCls} value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="Target completion"><input type="date" className={inputCls} value={f.completionDate} onChange={set("completionDate")} /></Field>
        </div>
      </Card>

      <Card title="Payment schedule" subtitle="Printed on the agreement and the work order.">
        <MilestoneEditor value={f.schedule} onChange={(schedule) => setF((p) => ({ ...p, schedule }))} total={quote?.total} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Not included (exclusions)">
          <textarea rows={4} className={inputCls + " resize-y"} value={f.exclusions} onChange={set("exclusions")} placeholder={"One per line, e.g.\nCivil / plumbing work\nAppliances and light fittings"} />
        </Card>
        <Card title="Work order instructions">
          <textarea rows={4} className={inputCls + " resize-y"} value={f.workOrderNotes} onChange={set("workOrderNotes")} placeholder={"One per line, e.g.\nSite working hours 9am–6pm\nSociety permission obtained by client"} />
        </Card>
      </div>

      <Card title="Agreement terms" subtitle="One clause per line — printed as numbered clauses. Defaults come from Settings.">
        <textarea rows={10} className={inputCls + " resize-y text-[13.5px]"} value={f.terms} onChange={set("terms")} />
      </Card>

      <div className="sticky bottom-[-50px] z-30 -mx-4 rounded-t-xl2 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(37,26,81,0.06)] backdrop-blur md:bottom-[-40px] md:-mx-6 md:px-6">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => router.back()} className={btn.secondary}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || !quotes.length} className={btn.primary + " px-5"}>{saving && <Loader2 size={15} className="animate-spin" />} {editing ? "Save changes" : "Create agreement"}</button>
        </div>
      </div>
    </div>
  );
}
