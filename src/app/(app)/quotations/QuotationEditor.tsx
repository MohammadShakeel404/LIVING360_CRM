"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Loader2, AlertTriangle, GripVertical } from "lucide-react";
import { Card, Field, PageHeader, inputCls, btn, formatCurrency } from "@/components/ui";
import { toast } from "@/components/toast";
import { quotationTotals, lineNet } from "@/lib/totals";

const CATEGORIES = ["Living Room", "Master Bedroom", "Bedroom 2", "Kids Room", "Modular Kitchen", "Wardrobe", "False Ceiling", "Electrical", "Painting", "Flooring", "Bathroom", "Furniture", "Miscellaneous"];
const UNITS = ["Sq.ft", "R.ft", "Nos", "Set", "Lot", "Lump Sum"];

export type EditorItem = {
  category: string; name: string; description: string; quantity: string; unit: string; rate: string; discountPct: string; gstPct: string;
};
export type EditorInitial = {
  id?: string;
  leadId: string;
  clientId: string;
  validUntil: string;
  discountPct: string;
  terms: string;
  items: EditorItem[];
};

const emptyItem = (category = CATEGORIES[0]): EditorItem => ({
  category, name: "", description: "", quantity: "1", unit: UNITS[0], rate: "", discountPct: "0", gstPct: "18",
});
const toNum = (v: string, fallback = 0) => (v.trim() === "" || Number.isNaN(Number(v)) ? fallback : Number(v));

export function QuotationEditor({
  initial, leads, clients, discountLimit, lockedParty,
}: {
  initial: EditorInitial;
  leads: { id: string; name: string; leadNumber: string }[];
  clients: { id: string; name: string; clientNumber: string }[];
  discountLimit: number;
  lockedParty?: string;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [items, setItems] = useState<EditorItem[]>(initial.items.length ? initial.items : [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const editing = !!initial.id;

  const numeric = items.map((i) => ({ quantity: toNum(i.quantity), rate: toNum(i.rate), discountPct: toNum(i.discountPct), gstPct: toNum(i.gstPct, 18) }));
  const t = useMemo(() => quotationTotals(numeric, toNum(f.discountPct)), [JSON.stringify(numeric), f.discountPct]); // eslint-disable-line react-hooks/exhaustive-deps
  const effective = t.subtotal > 0 ? ((t.itemDiscounts + t.overallDiscount) / t.subtotal) * 100 : 0;
  const overLimit = effective > discountLimit + 0.001;

  const problems = [
    !f.leadId && !f.clientId && "Choose a client or lead.",
    items.some((i) => !i.name.trim()) && "Every line item needs a name.",
    items.some((i) => toNum(i.quantity) <= 0) && "Quantities must be more than 0.",
    items.some((i) => i.rate.trim() === "") && "Every line item needs a rate.",
  ].filter(Boolean) as string[];

  const upd = (idx: number, k: keyof EditorItem, v: string) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  const move = (idx: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = idx + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  async function save() {
    setTouched(true);
    if (problems.length) return toast(problems[0], "error");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/quotations/${initial.id}` : "/api/quotations", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: f.leadId || null,
          clientId: f.clientId || null,
          validUntil: f.validUntil || null,
          termsAndConditions: f.terms,
          discountPct: toNum(f.discountPct),
          items: items.map((i, idx) => ({
            category: i.category.trim() || "Miscellaneous",
            name: i.name.trim(),
            description: i.description.trim() || null,
            ...numeric[idx],
            unit: i.unit,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the quotation.");
      toast(body.requiresApproval ? "Saved — sent to admin for discount approval." : editing ? "Quotation updated." : `Quotation ${body.quotation.quotationNumber} created.`);
      router.push(`/quotations/${editing ? initial.id : body.quotation.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={editing ? `/quotations/${initial.id}` : "/quotations"}
        title={editing ? "Edit quotation" : "New quotation"}
        subtitle="Prices are before GST. GST is calculated per line after discounts."
      />

      <Card title="Details">
        <div className="grid gap-3 md:grid-cols-2">
          {lockedParty ? (
            <Field label="Client / lead"><input className={inputCls} value={lockedParty} disabled /></Field>
          ) : (
            <Field label="Client or lead *" hint="Converted clients are listed first.">
              <select
                className={inputCls}
                value={f.clientId ? `c:${f.clientId}` : f.leadId ? `l:${f.leadId}` : ""}
                onChange={(e) => {
                  const [kind, id] = e.target.value.split(":");
                  setF((p) => ({ ...p, clientId: kind === "c" ? id : "", leadId: kind === "l" ? id : "" }));
                }}
              >
                <option value="">— Select —</option>
                {clients.length > 0 && (
                  <optgroup label="Clients">
                    {clients.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} ({c.clientNumber})</option>)}
                  </optgroup>
                )}
                {leads.length > 0 && (
                  <optgroup label="Open leads">
                    {leads.map((l) => <option key={l.id} value={`l:${l.id}`}>{l.name} ({l.leadNumber})</option>)}
                  </optgroup>
                )}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid until" hint={editing ? undefined : "Defaults from Settings"}>
              <input type="date" className={inputCls} value={f.validUntil} onChange={(e) => setF((p) => ({ ...p, validUntil: e.target.value }))} />
            </Field>
            <Field label="Overall discount %">
              <input type="number" min={0} max={100} step="0.5" className={inputCls} value={f.discountPct} onChange={(e) => setF((p) => ({ ...p, discountPct: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title={`Line items (${items.length})`}
        action={<button type="button" onClick={() => setItems((xs) => [...xs, emptyItem(xs[xs.length - 1]?.category)])} className={btn.ghost}><Plus size={14} /> Add item</button>}
      >
        <datalist id="qt-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="flex flex-col gap-3">
          {items.map((it, idx) => {
            const bad = touched && (!it.name.trim() || it.rate.trim() === "" || toNum(it.quantity) <= 0);
            return (
              <div key={idx} className={`rounded-xl2 border bg-appbg/60 p-3 ${bad ? "border-danger/40" : "border-line"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} className="text-ink-faint hover:text-primary disabled:opacity-30" disabled={idx === 0}>▲</button>
                      <button type="button" aria-label="Move down" onClick={() => move(idx, 1)} className="text-ink-faint hover:text-primary disabled:opacity-30" disabled={idx === items.length - 1}>▼</button>
                    </div>
                    <GripVertical size={14} className="hidden text-ink-faint md:block" />
                    <span className="text-[12.5px] font-semibold text-ink-soft">Item {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 text-[13px] font-bold text-ink">{formatCurrency(lineNet(numeric[idx]))}</span>
                    <button type="button" aria-label="Duplicate item" onClick={() => setItems((xs) => [...xs.slice(0, idx + 1), { ...it }, ...xs.slice(idx + 1)])} className="rounded-md p-1.5 text-ink-soft hover:bg-white hover:text-primary"><Copy size={14} /></button>
                    {items.length > 1 && (
                      <button type="button" aria-label="Remove item" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} className="rounded-md p-1.5 text-danger hover:bg-danger-bg"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
                  <Field label="Room / category" className="md:col-span-3"><input list="qt-categories" className={inputCls} value={it.category} onChange={(e) => upd(idx, "category", e.target.value)} /></Field>
                  <Field label="Item *" className="md:col-span-4"><input className={inputCls} value={it.name} placeholder="e.g. TV unit with back panel" onChange={(e) => upd(idx, "name", e.target.value)} /></Field>
                  <Field label="Specification" className="col-span-2 md:col-span-5"><input className={inputCls} value={it.description} placeholder="Material, finish, brand…" onChange={(e) => upd(idx, "description", e.target.value)} /></Field>
                  <Field label="Qty *" className="md:col-span-2"><input type="number" min={0} step="any" className={inputCls} value={it.quantity} onChange={(e) => upd(idx, "quantity", e.target.value)} /></Field>
                  <Field label="Unit" className="md:col-span-2">
                    <select className={inputCls} value={it.unit} onChange={(e) => upd(idx, "unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                  </Field>
                  <Field label="Rate (₹) *" className="md:col-span-3"><input type="number" min={0} step="any" className={inputCls} value={it.rate} placeholder="0" onChange={(e) => upd(idx, "rate", e.target.value)} /></Field>
                  <Field label="Disc %" className="md:col-span-2"><input type="number" min={0} max={100} step="0.5" className={inputCls} value={it.discountPct} onChange={(e) => upd(idx, "discountPct", e.target.value)} /></Field>
                  <Field label="GST %" className="md:col-span-3">
                    <select className={inputCls} value={it.gstPct} onChange={(e) => upd(idx, "gstPct", e.target.value)}>{["0", "5", "12", "18", "28"].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <Card title="Terms & conditions">
          <textarea rows={6} className={inputCls + " resize-y"} value={f.terms} onChange={(e) => setF((p) => ({ ...p, terms: e.target.value }))} placeholder="One point per line" />
        </Card>
        <Card title="Summary">
          <div className="space-y-1.5 text-[13.5px]">
            <Row label="Subtotal" value={t.subtotal} />
            {t.itemDiscounts > 0 && <Row label="Item discounts" value={-t.itemDiscounts} />}
            {t.overallDiscount > 0 && <Row label={`Overall discount (${f.discountPct}%)`} value={-t.overallDiscount} />}
            <Row label="Taxable value" value={t.taxable} />
            <Row label="GST" value={t.gst} />
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-bold text-primary"><span>Grand total</span><span>{formatCurrency(t.grandTotal)}</span></div>
          </div>
          {overLimit && (
            <div className="mt-3 flex gap-2 rounded-lg bg-warning-bg p-2.5 text-[12.5px] font-medium text-warning">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              Total discount is {effective.toFixed(1)}%, above your {discountLimit}% limit. An admin must approve it before it can be sent.
            </div>
          )}
        </Card>
      </div>

      <div className="sticky bottom-[-50px] z-30 -mx-4 rounded-t-xl2 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(37,26,81,0.06)] backdrop-blur md:bottom-[-40px] md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] text-ink-soft">Grand total (incl. GST)</div>
            <div className="text-[17px] font-bold text-ink">{formatCurrency(t.grandTotal)}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className={btn.secondary}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btn.primary + " px-5"}>
              {saving && <Loader2 size={15} className="animate-spin" />} {editing ? "Save changes" : "Create quotation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <span>{label}</span>
      <span className="font-medium text-ink">{value < 0 ? "− " + formatCurrency(-value) : formatCurrency(value)}</span>
    </div>
  );
}
