"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X, Plus, Trash2 } from "lucide-react";
import { QuotationListItem } from "./QuotationsClient";

const CATEGORIES = ["Furniture", "Modular Kitchen", "Wardrobe", "False Ceiling", "Electrical", "Painting", "Flooring", "Bathroom", "Miscellaneous"];
const UNITS = ["Sq.ft", "R.ft", "Nos", "Set", "Lot", "Lump Sum"];
const inputCls = "rounded-[10px] border-[1.5px] border-line bg-appbg px-3 py-2.5 text-[14.5px] outline-none focus:border-primary";

type LineItem = {
  category: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  discountPct: string;
  gstPct: string;
};

const emptyItem = (): LineItem => ({
  category: CATEGORIES[0], name: "", description: "", quantity: "1", unit: UNITS[0], rate: "", discountPct: "0", gstPct: "18",
});

export function NewQuotationSheet({
  open, onClose, clients, leads, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  leads: { id: string; name: string; leadNumber: string }[];
  onCreated: (qt: QuotationListItem) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ clientId: "", leadId: "", validUntil: "", terms: "", discountPct: "0" });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setStep(0); setError(null); setItems([emptyItem()]); setForm({ clientId: "", leadId: "", validUntil: "", terms: "", discountPct: "0" }); }
  }, [open]);
  if (!open) return null;

  const steps = ["Details", "Line Items", "Review"];
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function updateItem(idx: number, key: keyof LineItem, val: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }
  function addItem() { setItems((prev) => [...prev, emptyItem()]); }

  const computedTotal = items.reduce((sum, i) => {
    const base = (Number(i.quantity) || 0) * (Number(i.rate) || 0);
    const disc = base * ((Number(i.discountPct) || 0) / 100);
    const gst = (base - disc) * ((Number(i.gstPct) || 0) / 100);
    return sum + (base - disc) + gst;
  }, 0);

  const canNext = step === 0 ? (form.clientId || form.leadId) : step === 1 ? items.length > 0 && items.every((i) => i.name && i.rate) : true;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId || undefined,
          leadId: form.leadId || undefined,
          validUntil: form.validUntil || undefined,
          termsAndConditions: form.terms || undefined,
          discountPct: Number(form.discountPct) || 0,
          items: items.map((i, idx) => ({
            category: i.category,
            name: i.name,
            description: i.description || undefined,
            quantity: Number(i.quantity) || 1,
            unit: i.unit,
            rate: Number(i.rate) || 0,
            discountPct: Number(i.discountPct) || 0,
            gstPct: Number(i.gstPct) || 18,
            sortOrder: idx,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Couldn't create quotation.");

      const qt = body.quotation;
      onCreated({
        id: qt.id,
        quotationNumber: qt.quotationNumber,
        version: qt.version,
        status: qt.status,
        requiresApproval: qt.requiresApproval,
        discountPct: qt.discountPct?.toString() ?? "0",
        clientName: clients.find((c) => c.id === form.clientId)?.name ?? leads.find((l) => l.id === form.leadId)?.name ?? "—",
        clientId: form.clientId || null,
        leadId: form.leadId || null,
        salesperson: "You",
        itemCount: items.length,
        total: computedTotal.toString(),
        validUntil: form.validUntil || null,
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (e: any) { setError(e.message); } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] max-w-[580px] flex-col rounded-t-[20px] bg-white">
        <div className="px-5 pt-2.5">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-ink">New Quotation</span>
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
              <Field label="Client (if converted)">
                <select value={form.clientId} onChange={set("clientId")} className={inputCls}>
                  <option value="">— Select client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Or lead (if not yet converted)">
                <select value={form.leadId} onChange={set("leadId")} className={inputCls}>
                  <option value="">— Select lead —</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.leadNumber})</option>)}
                </select>
              </Field>
              <Field label="Valid until">
                <input type="date" value={form.validUntil} onChange={set("validUntil")} className={inputCls} />
              </Field>
              <Field label="Overall discount %">
                <input type="number" min="0" max="100" value={form.discountPct} onChange={set("discountPct")} className={inputCls} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-xl2 border border-line bg-appbg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-ink-soft">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-danger"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Category">
                      <select value={item.category} onChange={(e) => updateItem(idx, "category", e.target.value)} className={inputCls}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Name">
                      <input value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} placeholder="e.g. TV Unit" className={inputCls} />
                    </Field>
                    <Field label="Qty">
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Unit">
                      <select value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className={inputCls}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </Field>
                    <Field label="Rate (₹)">
                      <input type="number" min="0" value={item.rate} onChange={(e) => updateItem(idx, "rate", e.target.value)} placeholder="0" className={inputCls} />
                    </Field>
                    <Field label="GST %">
                      <input type="number" min="0" max="28" value={item.gstPct} onChange={(e) => updateItem(idx, "gstPct", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="flex items-center gap-1.5 self-start rounded-[10px] bg-line-soft px-3 py-2 text-[13px] font-semibold text-primary">
                <Plus size={14} /> Add item
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl2 border border-line bg-appbg p-4">
                <div className="mb-2 text-[13px] font-semibold text-ink">Summary</div>
                <div className="space-y-1 text-[13px] text-ink-soft">
                  <div className="flex justify-between"><span>Items</span><span className="font-semibold text-ink">{items.length}</span></div>
                  <div className="flex justify-between"><span>Grand Total (incl. GST)</span><span className="text-[15px] font-bold text-primary">₹{Math.round(computedTotal).toLocaleString("en-IN")}</span></div>
                </div>
              </div>
              <Field label="Terms & Conditions (optional)">
                <textarea value={form.terms} onChange={set("terms") as any} rows={3} placeholder="Payment terms, warranty, delivery..." className={inputCls + " resize-none"} />
              </Field>
            </div>
          )}

          {error && <div className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}
        </div>

        <div className="flex gap-2.5 border-t border-line p-4">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="w-12 flex-shrink-0 rounded-xl2 bg-line-soft">
              <ChevronLeft size={18} className="mx-auto" />
            </button>
          )}
          {step < steps.length - 1 ? (
            <button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="flex-1 rounded-xl2 bg-primary py-3 text-[14.5px] font-semibold text-white disabled:opacity-50">
              Continue
            </button>
          ) : (
            <button disabled={submitting} onClick={handleSubmit} className="flex-1 rounded-xl2 bg-primary py-3 text-[14.5px] font-semibold text-white disabled:opacity-60">
              {submitting ? "Creating…" : "Create quotation"}
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
