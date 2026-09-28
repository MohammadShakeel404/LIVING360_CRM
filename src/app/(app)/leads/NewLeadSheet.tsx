"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { LeadListItem } from "./LeadsClient";
import { toast } from "@/components/toast";

import { LEAD_SOURCES as SOURCES, PROPERTY_TYPES, humanize } from "@/lib/labels";

const EMPTY = { name: "", phone: "", email: "", source: "INSTAGRAM", propertyType: PROPERTY_TYPES[1], budgetMin: "", budgetMax: "", location: "" };

const inputCls = "rounded-[10px] border-[1.5px] border-line bg-appbg px-3 py-2.5 text-[14.5px] outline-none focus:border-primary";

export function NewLeadSheet({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (lead: LeadListItem) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  useEffect(() => { if (open) { setStep(0); setError(null); setDupWarning(null); } }, [open]);
  if (!open) return null;

  const steps = ["Contact", "Requirement"];
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const canNext = step === 0 ? form.name.trim() && form.phone.replace(/\D/g, "").length >= 10 && (!form.email || /^\S+@\S+\.\S+$/.test(form.email)) : true;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), source: form.source, propertyType: form.propertyType,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
          projectLocation: form.location,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Please check the details and try again.");
      const dup = body.duplicateWarning;
      if (dup) setDupWarning(`Heads up — ${dup.name} already has this phone number on file.`);
      onCreated({
        ...body.lead,
        budgetMin: body.lead.budgetMin?.toString() ?? null,
        budgetMax: body.lead.budgetMax?.toString() ?? null,
        assignedTo: null,
      });
      toast(`Lead ${body.lead.leadNumber} created.`);
      setForm(EMPTY);
      setTimeout(onClose, dup ? 2200 : 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] max-w-[520px] flex-col rounded-t-[20px] bg-white">
        <div className="px-5 pt-2.5">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-ink">New lead</span>
            <button onClick={onClose}><X size={18} className="text-ink-soft" /></button>
          </div>
          <div className="mb-4 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className={`h-[3px] flex-1 rounded ${i <= step ? "bg-primary" : "bg-line"}`} />
            ))}
          </div>
          <div className="mb-3.5 text-[12.5px] font-medium text-ink-soft">Step {step + 1} of {steps.length} — {steps[step]}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <Field label="Full name"><input value={form.name} onChange={set("name")} placeholder="e.g. Rahul Verma" className={inputCls} /></Field>
              <Field label="Mobile number"><input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="+91 98xxxxxxx" className={inputCls} /></Field>
              <Field label="Email (optional)"><input type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" className={inputCls} /></Field>
              <Field label="Lead source">
                <select value={form.source} onChange={set("source")} className={inputCls}>
                  {SOURCES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </select>
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <Field label="Property type">
                <select value={form.propertyType} onChange={set("propertyType")} className={inputCls}>
                  {PROPERTY_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Budget min (₹)"><input type="number" min={0} value={form.budgetMin} onChange={set("budgetMin")} placeholder="e.g. 1500000" className={inputCls} /></Field>
                <Field label="Budget max (₹)"><input type="number" min={0} value={form.budgetMax} onChange={set("budgetMax")} placeholder="e.g. 1800000" className={inputCls} /></Field>
              </div>
              <Field label="Project location"><input value={form.location} onChange={set("location")} placeholder="e.g. Whitefield, Bengaluru" className={inputCls} /></Field>
            </div>
          )}
          {error && <div className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
          {dupWarning && <div className="mt-3 rounded-lg bg-warning-bg px-3 py-2 text-[12.5px] font-medium text-warning">{dupWarning}</div>}
        </div>

        <div className="flex gap-2.5 border-t border-line p-4">
          {step > 0 && (
            <button onClick={() => setStep(0)} className="w-12 flex-shrink-0 rounded-xl2 bg-line-soft"><ChevronLeft size={18} className="mx-auto" /></button>
          )}
          {step < steps.length - 1 ? (
            <button disabled={!canNext} onClick={() => setStep(step + 1)} className="flex-1 rounded-xl2 bg-primary py-3 text-[14.5px] font-semibold text-white disabled:opacity-50">
              Continue
            </button>
          ) : (
            <button disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-xl2 bg-primary py-3 text-[14.5px] font-semibold text-white disabled:opacity-60">
              {submitting ? "Creating…" : "Create lead"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
