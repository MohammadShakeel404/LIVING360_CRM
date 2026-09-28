"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Wand2, Info } from "lucide-react";
import { Card, Field, PageHeader, inputCls, btn, formatCurrency } from "@/components/ui";
import { toast } from "@/components/toast";
import { invoiceTotals } from "@/lib/totals";
import { INVOICE_TYPES, humanize } from "@/lib/labels";

export type QuoteOption = {
  id: string;
  quotationNumber: string;
  status: string;
  total: number;
  invoiced: number;
  lines: { title: string; quantity: number; unit: string; netRate: number; gstPct: number }[];
};
export type CosOption = { id: string; cosNumber: string; title: string; projectId: string; net: number; invoiced: number; byGst: { gstPct: number; taxable: number }[] };
export type ClientOption = { id: string; name: string; clientNumber: string; quotations: QuoteOption[]; projects: { id: string; projectNumber: string }[]; changeOrders: CosOption[] };
type Line = { description: string; hsnSac: string; quantity: string; unit: string; rate: string; gstPct: string };
export type InvoiceInitial = {
  id?: string; clientId: string; quotationId: string; projectId: string; changeOrderId: string; type: string;
  invoiceDate: string; dueDate: string; notes: string; items: Line[];
};

const blank = (): Line => ({ description: "", hsnSac: "", quantity: "1", unit: "Lot", rate: "", gstPct: "18" });
const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function InvoiceEditor({ initial, clients }: { initial: InvoiceInitial; clients: ClientOption[] }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [items, setItems] = useState<Line[]>(initial.items.length ? initial.items : [blank()]);
  const [pct, setPct] = useState("50");
  const [saving, setSaving] = useState(false);
  const editing = !!initial.id;

  const client = clients.find((c) => c.id === f.clientId);
  const quote = client?.quotations.find((q) => q.id === f.quotationId);
  const t = useMemo(() => invoiceTotals(items.map((i) => ({ quantity: num(i.quantity), rate: num(i.rate), gstPct: num(i.gstPct) }))), [items]);
  const cos = client?.changeOrders.find((c) => c.id === f.changeOrderId);
  const remaining = quote ? Math.max(quote.total - quote.invoiced, 0) : cos ? Math.max(cos.net - cos.invoiced, 0) : null;

  /** One line per GST rate for the COS's net additions. */
  function fillCos() {
    if (!cos) return;
    const rows = cos.byGst.filter((g) => g.taxable > 0);
    if (!rows.length) return toast("This change of scope has no net amount to bill.", "error");
    setItems(rows.map((g) => ({
      description: `Change of scope ${cos.cosNumber} — ${cos.title}${rows.length > 1 ? ` (${g.gstPct}% GST)` : ""}`,
      hsnSac: "", quantity: "1", unit: "Lot", rate: String(r2(g.taxable)), gstPct: String(g.gstPct),
    })));
    setF((p) => ({ ...p, type: "CUSTOM", projectId: cos.projectId }));
  }

  const set = (k: keyof InvoiceInitial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const upd = (idx: number, k: keyof Line, v: string) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));

  function fillAll() {
    if (!quote) return;
    setItems(quote.lines.map((l) => ({ description: l.title, hsnSac: "", quantity: String(l.quantity), unit: l.unit, rate: String(r2(l.netRate)), gstPct: String(l.gstPct) })));
    setF((p) => ({ ...p, type: p.type === "ADVANCE" ? "FINAL" : p.type }));
  }

  /** One line per GST rate so a % bill keeps the quotation's tax split exact. */
  function fillPercent() {
    if (!quote) return;
    const p = num(pct);
    if (p <= 0 || p > 100) return toast("Enter a percentage between 1 and 100.", "error");
    const byGst = new Map<number, number>();
    for (const l of quote.lines) byGst.set(l.gstPct, (byGst.get(l.gstPct) ?? 0) + l.quantity * l.netRate);
    const label = `${humanize(f.type)} payment — ${p}% of quotation ${quote.quotationNumber}`;
    setItems([...byGst.entries()].map(([gst, taxable]) => ({
      description: byGst.size > 1 ? `${label} (items at ${gst}% GST)` : label,
      hsnSac: "", quantity: "1", unit: "Lot", rate: String(r2((taxable * p) / 100)), gstPct: String(gst),
    })));
  }

  async function save() {
    if (!f.clientId) return toast("Choose a client.", "error");
    if (items.some((i) => !i.description.trim() || i.rate.trim() === "" || num(i.quantity) <= 0)) return toast("Every line needs a description, quantity and rate.", "error");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/invoices/${initial.id}` : "/api/invoices", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: f.clientId, quotationId: f.quotationId || null, projectId: f.projectId || null, changeOrderId: f.changeOrderId || null, type: f.type,
          invoiceDate: f.invoiceDate || null, dueDate: f.dueDate || null, notes: f.notes,
          items: items.map((i) => ({ description: i.description.trim(), hsnSac: i.hsnSac.trim() || null, quantity: num(i.quantity), unit: i.unit.trim() || "Nos", rate: num(i.rate), gstPct: num(i.gstPct) })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the invoice.");
      toast(editing ? "Invoice updated." : `Invoice ${body.invoice.invoiceNumber} created as draft.`);
      router.push(`/invoices/${editing ? initial.id : body.invoice.id}`);
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={editing ? `/invoices/${initial.id}` : "/invoices"} title={editing ? "Edit invoice" : "New invoice"} subtitle="Saved as a draft. Issue it when it's ready to go to the client." />

      <Card title="Bill to">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Client *">
            <select className={inputCls} value={f.clientId} onChange={(e) => setF((p) => ({ ...p, clientId: e.target.value, quotationId: "", projectId: "", changeOrderId: "" }))}>
              <option value="">— Select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.clientNumber})</option>)}
            </select>
          </Field>
          <Field label="Invoice type">
            <select className={inputCls} value={f.type} onChange={set("type")}>{INVOICE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
          </Field>
          <Field label="Against quotation" hint={client && !client.quotations.length ? "This client has no sent or accepted quotations." : undefined}>
            <select className={inputCls} value={f.quotationId} onChange={(e) => setF((p) => ({ ...p, quotationId: e.target.value, changeOrderId: e.target.value ? "" : p.changeOrderId }))} disabled={!client}>
              <option value="">— None —</option>
              {client?.quotations.map((q) => <option key={q.id} value={q.id}>{q.quotationNumber} · {formatCurrency(q.total)} ({q.status === "APPROVED" ? "accepted" : q.status.toLowerCase()})</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select className={inputCls} value={f.projectId} onChange={set("projectId")} disabled={!client}>
              <option value="">— None —</option>
              {client?.projects.map((p) => <option key={p.id} value={p.id}>{p.projectNumber}</option>)}
            </select>
          </Field>
          {client && client.changeOrders.length > 0 && (
            <Field label="Or against change of scope" hint="Approved COS only. Billed on its own invoice.">
              <select className={inputCls} value={f.changeOrderId} onChange={(e) => setF((p) => ({ ...p, changeOrderId: e.target.value, quotationId: e.target.value ? "" : p.quotationId }))}>
                <option value="">— None —</option>
                {client.changeOrders.map((c) => <option key={c.id} value={c.id}>{c.cosNumber} · {c.title} · {formatCurrency(c.net)}</option>)}
              </select>
            </Field>
          )}
          <Field label="Invoice date"><input type="date" className={inputCls} value={f.invoiceDate} onChange={set("invoiceDate")} /></Field>
          <Field label="Due date"><input type="date" className={inputCls} value={f.dueDate} onChange={set("dueDate")} /></Field>
        </div>
      </Card>

      {quote && (
        <div className="flex flex-col gap-3 rounded-xl2 border border-primary/20 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2.5 text-[13px] text-ink">
            <Info size={17} className="mt-0.5 flex-shrink-0 text-primary" />
            <div>
              <b>{quote.quotationNumber}</b>: {formatCurrency(quote.total)} total · {formatCurrency(quote.invoiced)} already invoiced ·{" "}
              <b className="text-primary">{formatCurrency(remaining)} left to bill</b>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-[10px] border border-line bg-white">
              <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className="w-14 px-2 py-[7px] text-right text-[13px] outline-none" aria-label="Percentage" />
              <span className="pr-2 text-[13px] text-ink-soft">%</span>
              <button type="button" onClick={fillPercent} className="border-l border-line px-3 py-[7px] text-[13px] font-semibold text-primary hover:bg-line-soft">Bill %</button>
            </div>
            <button type="button" onClick={fillAll} className={btn.secondary}><Wand2 size={14} /> Copy all items</button>
          </div>
        </div>
      )}

      {cos && (
        <div className="flex flex-col gap-3 rounded-xl2 border border-primary/20 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2.5 text-[13px] text-ink">
            <Info size={17} className="mt-0.5 flex-shrink-0 text-primary" />
            <div><b>{cos.cosNumber}</b>: {formatCurrency(cos.net)} net · {formatCurrency(cos.invoiced)} already invoiced · <b className="text-primary">{formatCurrency(remaining)} left to bill</b></div>
          </div>
          <button type="button" onClick={fillCos} className={btn.secondary}><Wand2 size={14} /> Bill this COS</button>
        </div>
      )}

      <Card title="Lines" action={<button type="button" onClick={() => setItems((xs) => [...xs, blank()])} className={btn.ghost}><Plus size={14} /> Add line</button>}>
        <div className="flex flex-col gap-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl2 border border-line bg-appbg/60 p-3 md:grid-cols-12 md:items-end">
              <Field label={`Description ${idx + 1} *`} className="col-span-2 md:col-span-5"><input className={inputCls} value={it.description} onChange={(e) => upd(idx, "description", e.target.value)} /></Field>
              <Field label="HSN/SAC" className="md:col-span-1"><input className={inputCls + " px-2"} value={it.hsnSac} onChange={(e) => upd(idx, "hsnSac", e.target.value)} /></Field>
              <Field label="Qty" className="md:col-span-1"><input type="number" min={0} step="any" className={inputCls + " px-2"} value={it.quantity} onChange={(e) => upd(idx, "quantity", e.target.value)} /></Field>
              <Field label="Unit" className="md:col-span-1"><input className={inputCls + " px-2"} value={it.unit} onChange={(e) => upd(idx, "unit", e.target.value)} /></Field>
              <Field label="Rate (₹)" className="md:col-span-2"><input type="number" min={0} step="any" className={inputCls} value={it.rate} onChange={(e) => upd(idx, "rate", e.target.value)} /></Field>
              <Field label="GST" className="md:col-span-1">
                <select className={inputCls + " px-2"} value={it.gstPct} onChange={(e) => upd(idx, "gstPct", e.target.value)}>{["0", "5", "12", "18", "28"].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
              </Field>
              <div className="flex items-center justify-between gap-2 md:col-span-1 md:flex-col md:items-end">
                <span className="text-[13px] font-bold text-ink">{formatCurrency(num(it.quantity) * num(it.rate))}</span>
                {items.length > 1 && <button type="button" aria-label="Remove line" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} className="rounded-md p-1.5 text-danger hover:bg-danger-bg"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <Card title="Notes"><textarea rows={4} className={inputCls + " resize-y"} value={f.notes} onChange={set("notes")} placeholder="Printed on the invoice (e.g. milestone details)." /></Card>
        <Card title="Summary">
          <div className="space-y-1.5 text-[13.5px]">
            <div className="flex justify-between text-ink-soft"><span>Taxable value</span><span className="font-medium text-ink">{formatCurrency(t.taxable)}</span></div>
            <div className="flex justify-between text-ink-soft"><span>GST</span><span className="font-medium text-ink">{formatCurrency(t.gst)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-bold text-primary"><span>Invoice total</span><span>{formatCurrency(t.grandTotal)}</span></div>
          </div>
          {remaining !== null && t.grandTotal > remaining + 5 && (
            <div className="mt-3 rounded-lg bg-danger-bg p-2.5 text-[12.5px] font-medium text-danger">This is more than the {formatCurrency(remaining)} left to bill on the quotation.</div>
          )}
        </Card>
      </div>

      <div className="sticky bottom-[-50px] z-30 -mx-4 rounded-t-xl2 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-6px_20px_rgba(37,26,81,0.06)] backdrop-blur md:bottom-[-40px] md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] text-ink-soft">Invoice total</div>
            <div className="text-[17px] font-bold text-ink">{formatCurrency(t.grandTotal)}</div>
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
